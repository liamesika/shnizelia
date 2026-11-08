import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DEFAULT_PRODUCTS, DEFAULT_SETTINGS } from "../config";
import type { FridayOverride, Order, Product, Settings } from "../types";
import type { Store } from "./types";
import { PAYABLE_FROM, holdsStock, sumUnits } from "./shared";

/**
 * Local development store: one JSON file under .data/. Lets the site run with
 * zero external setup. NOT for production (no multi-instance safety) — the
 * factory refuses to use it when NODE_ENV=production.
 */
interface DB {
  settings: Settings;
  products: Product[];
  overrides: FridayOverride[];
  orders: Order[];
  nextOrderNumber: number;
}

const FILE = path.join(process.cwd(), ".data", "dev-db.json");
let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<DB> {
  try {
    const db = JSON.parse(await fs.readFile(FILE, "utf8")) as DB;
    db.settings = { ...DEFAULT_SETTINGS, ...db.settings };
    return db;
  } catch {
    return {
      settings: structuredClone(DEFAULT_SETTINGS),
      products: structuredClone(DEFAULT_PRODUCTS),
      overrides: [],
      orders: [],
      nextOrderNumber: 1001,
    };
  }
}

async function save(db: DB) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(db, null, 2));
  await fs.rename(tmp, FILE);
}

/** Serializes all access so read-modify-write is atomic within the process. */
function tx<T>(fn: (db: DB) => T | Promise<T>, write = false): Promise<T> {
  const run = queue.then(async () => {
    const db = await load();
    const result = await fn(db);
    if (write) await save(db);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

const now = () => new Date().toISOString();

function patch(db: DB, id: string, fn: (o: Order) => boolean | void): Order | null {
  const o = db.orders.find((x) => x.id === id);
  if (!o) return null;
  if (fn(o) === false) return null;
  o.updatedAt = now();
  return structuredClone(o);
}

export const fileStore: Store = {
  getSettings: () => tx((db) => db.settings),
  saveSettings: (s) => tx((db) => void (db.settings = s), true),

  getProducts: () => tx((db) => [...db.products].sort((a, b) => a.sortOrder - b.sortOrder)),
  saveProduct: (p) =>
    tx((db) => {
      db.products = db.products.map((x) => (x.id === p.id ? p : x));
    }, true),

  getOverrides: () => tx((db) => db.overrides),
  saveOverride: (o) =>
    tx((db) => {
      db.overrides = [...db.overrides.filter((x) => x.date !== o.date), o].sort((a, b) => a.date.localeCompare(b.date));
    }, true),
  deleteOverride: (date) => tx((db) => void (db.overrides = db.overrides.filter((x) => x.date !== date)), true),

  createPendingOrder: (input, limits, holdMinutes) =>
    tx((db) => {
      const existing = db.orders.find((o) => o.idempotencyKey === input.idempotencyKey);
      if (existing) return { kind: "existing" as const, order: structuredClone(existing) };

      const t = Date.now();
      const taken = sumUnits(db.orders.filter((o) => o.fridayDate === input.fridayDate && holdsStock(o, t, holdMinutes)));
      for (const [pid, limit] of Object.entries(limits)) {
        if (limit == null) continue;
        const want = input.items.filter((i) => i.productId === pid).reduce((s, i) => s + i.quantity, 0);
        const used = taken[pid as keyof typeof taken] ?? 0;
        if (want > 0 && used + want > limit) {
          return { kind: "sold_out" as const, productId: pid as Product["id"], remaining: Math.max(0, limit - used) };
        }
      }
      const order: Order = {
        ...input,
        id: randomUUID(),
        orderNumber: db.nextOrderNumber++,
        paymentRef: null,
        paymentUrl: null,
        paidAt: null,
        cancelRequestedAt: null,
        cancelReason: null,
        refundStartedAt: null,
        refundAgorot: null,
        refundRef: null,
        refundedAt: null,
        notifiedAt: null,
        createdAt: now(),
        updatedAt: now(),
      };
      db.orders.push(order);
      return { kind: "created" as const, order: structuredClone(order) };
    }, true),

  setPaymentDetails: (id, d) => tx((db) => void patch(db, id, (o) => void Object.assign(o, d)), true),

  markPaid: (id, ref) =>
    tx(
      (db) =>
        patch(db, id, (o) => {
          if (!PAYABLE_FROM.includes(o.status)) return false;
          o.status = "paid";
          o.paymentStatus = "paid";
          o.paidAt = now();
          if (ref) o.paymentRef = ref;
        }),
      true,
    ),
  markPaymentFailed: (id) =>
    tx(
      (db) =>
        void patch(db, id, (o) => {
          if (o.status !== "pending_payment") return false;
          o.status = "payment_failed";
          o.paymentStatus = "failed";
        }),
      true,
    ),
  markNotified: (id) => tx((db) => void patch(db, id, (o) => void (o.notifiedAt = now())), true),

  getOrder: (id) => tx((db) => structuredClone(db.orders.find((o) => o.id === id) ?? null)),
  getOrderByToken: (token) => tx((db) => structuredClone(db.orders.find((o) => o.publicToken === token) ?? null)),
  listOrders: (friday) =>
    tx((db) => structuredClone(db.orders.filter((o) => o.fridayDate === friday).sort((a, b) => a.orderNumber - b.orderNumber))),
  unitsTaken: (friday, hold) =>
    tx((db) => {
      const t = Date.now();
      return sumUnits(db.orders.filter((o) => o.fridayDate === friday && holdsStock(o, t, hold)));
    }),

  updateStatus: (id, status) => tx((db) => void patch(db, id, (o) => void (o.status = status)), true),
  requestCancellation: (id, reason) =>
    tx(
      (db) =>
        patch(db, id, (o) => {
          if (!["paid", "preparing", "ready"].includes(o.status)) return false;
          o.status = "cancel_requested";
          o.cancelRequestedAt = now();
          o.cancelReason = reason;
        }),
      true,
    ),

  claimRefund: (id) =>
    tx(
      (db) =>
        patch(db, id, (o) => {
          if (o.refundStartedAt || o.refundedAt || o.paymentStatus !== "paid") return false;
          o.refundStartedAt = now();
        }),
      true,
    ),
  completeRefund: (id, amount, ref) =>
    tx(
      (db) =>
        void patch(db, id, (o) => {
          o.refundAgorot = amount;
          o.refundRef = ref;
          o.refundedAt = now();
          o.paymentStatus = amount >= o.totalAgorot ? "refunded" : "partially_refunded";
          o.status = "cancelled";
        }),
      true,
    ),
  releaseRefund: (id) => tx((db) => void patch(db, id, (o) => void (o.refundStartedAt = null)), true),
};
