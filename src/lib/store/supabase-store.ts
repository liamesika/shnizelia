import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_PRODUCTS, DEFAULT_SETTINGS } from "../config";
import type { FridayOverride, Order, OrderStatus, Product, Settings } from "../types";
import type { CreateOrderResult, Store } from "./types";
import { PAYABLE_FROM, holdsStock, sumUnits } from "./shared";

let client: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set");
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  return res.data;
}

/** For list queries: never null. */
function rowsOf<T>(res: { data: T[] | null; error: { message: string } | null }): T[] {
  return check(res) ?? [];
}

type Row = Record<string, unknown>;

function toOrder(r: Row): Order {
  return {
    id: r.id as string,
    orderNumber: Number(r.order_number),
    publicToken: r.public_token as string,
    idempotencyKey: r.idempotency_key as string,
    fridayDate: String(r.friday_date).slice(0, 10),
    status: r.status as OrderStatus,
    paymentStatus: r.payment_status as Order["paymentStatus"],
    customerName: r.customer_name as string,
    phone: r.phone as string,
    fulfillment: r.fulfillment as Order["fulfillment"],
    address: (r.address as string) ?? null,
    apartment: (r.apartment as string) ?? null,
    floor: (r.floor as string) ?? null,
    deliveryNotes: (r.delivery_notes as string) ?? null,
    items: r.items as Order["items"],
    subtotalAgorot: Number(r.subtotal_agorot),
    deliveryFeeAgorot: Number(r.delivery_fee_agorot),
    totalAgorot: Number(r.total_agorot),
    termsAcceptedAt: r.terms_accepted_at as string,
    policySnapshot: r.policy_snapshot as string,
    paymentProvider: r.payment_provider as string,
    paymentRef: (r.payment_ref as string) ?? null,
    paymentUrl: (r.payment_url as string) ?? null,
    paidAt: (r.paid_at as string) ?? null,
    cancelRequestedAt: (r.cancel_requested_at as string) ?? null,
    cancelReason: (r.cancel_reason as string) ?? null,
    refundStartedAt: (r.refund_started_at as string) ?? null,
    refundAgorot: r.refund_agorot == null ? null : Number(r.refund_agorot),
    refundRef: (r.refund_ref as string) ?? null,
    refundedAt: (r.refunded_at as string) ?? null,
    notifiedAt: (r.notified_at as string) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function toProduct(r: Row): Product {
  return {
    id: r.id as Product["id"],
    name: r.name as string,
    description: r.description as string,
    priceAgorot: Number(r.price_agorot),
    image: r.image as string,
    imageAlt: r.image_alt as string,
    available: Boolean(r.available),
    weeklyLimit: r.weekly_limit == null ? null : Number(r.weekly_limit),
    requiresDrink: Boolean(r.requires_drink),
    sortOrder: Number(r.sort_order),
  };
}

function fromProduct(p: Product): Row {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price_agorot: p.priceAgorot,
    image: p.image,
    image_alt: p.imageAlt,
    available: p.available,
    weekly_limit: p.weeklyLimit,
    requires_drink: p.requiresDrink,
    sort_order: p.sortOrder,
    updated_at: new Date().toISOString(),
  };
}

const nowIso = () => new Date().toISOString();

async function one(id: string): Promise<Order | null> {
  const data = check(await db().from("orders").select("*").eq("id", id).maybeSingle());
  return data ? toOrder(data) : null;
}

export const supabaseStore: Store = {
  async getSettings() {
    const data = check(await db().from("app_settings").select("data").eq("id", 1).maybeSingle());
    if (!data) {
      check(await db().from("app_settings").upsert({ id: 1, data: DEFAULT_SETTINGS }));
      return structuredClone(DEFAULT_SETTINGS);
    }
    return { ...DEFAULT_SETTINGS, ...(data.data as Settings) };
  },
  async saveSettings(s) {
    check(await db().from("app_settings").upsert({ id: 1, data: s, updated_at: nowIso() }));
  },

  async getProducts() {
    const rows = rowsOf(await db().from("products").select("*").order("sort_order"));
    if (!rows.length) {
      check(await db().from("products").upsert(DEFAULT_PRODUCTS.map(fromProduct)));
      return structuredClone(DEFAULT_PRODUCTS);
    }
    return rows.map(toProduct);
  },
  async saveProduct(p) {
    check(await db().from("products").upsert(fromProduct(p)));
  },

  async getOverrides() {
    const rows = rowsOf(await db().from("friday_overrides").select("*").order("date"));
    return rows.map((r) => ({ date: String(r.date).slice(0, 10), closed: r.closed, note: r.note }) as FridayOverride);
  },
  async saveOverride(o) {
    check(await db().from("friday_overrides").upsert(o));
  },
  async deleteOverride(date) {
    check(await db().from("friday_overrides").delete().eq("date", date));
  },

  async createPendingOrder(o, limits, holdMinutes): Promise<CreateOrderResult> {
    const payload = {
      public_token: o.publicToken,
      idempotency_key: o.idempotencyKey,
      friday_date: o.fridayDate,
      customer_name: o.customerName,
      phone: o.phone,
      fulfillment: o.fulfillment,
      address: o.address,
      apartment: o.apartment,
      floor: o.floor,
      delivery_notes: o.deliveryNotes,
      items: o.items,
      subtotal_agorot: o.subtotalAgorot,
      delivery_fee_agorot: o.deliveryFeeAgorot,
      total_agorot: o.totalAgorot,
      terms_accepted_at: o.termsAcceptedAt,
      policy_snapshot: o.policySnapshot,
      payment_provider: o.paymentProvider,
    };
    const res = check(
      await db().rpc("create_pending_order", { p_order: payload, p_limits: limits, p_hold_minutes: holdMinutes }),
    ) as { kind: string; order?: Row; productId?: string; remaining?: number };
    if (res.kind === "sold_out") {
      return { kind: "sold_out", productId: res.productId as Product["id"], remaining: Number(res.remaining) };
    }
    return { kind: res.kind as "created" | "existing", order: toOrder(res.order!) };
  },

  async setPaymentDetails(id, d) {
    check(await db().from("orders").update({ payment_ref: d.paymentRef, payment_url: d.paymentUrl }).eq("id", id));
  },

  async markPaid(id, ref) {
    const patch: Row = { status: "paid", payment_status: "paid", paid_at: nowIso() };
    if (ref) patch.payment_ref = ref;
    const rows = rowsOf(await db().from("orders").update(patch).eq("id", id).in("status", PAYABLE_FROM).select("*"));
    return rows.length ? toOrder(rows[0]) : null;
  },
  async markPaymentFailed(id) {
    check(
      await db()
        .from("orders")
        .update({ status: "payment_failed", payment_status: "failed" })
        .eq("id", id)
        .eq("status", "pending_payment"),
    );
  },
  async markNotified(id) {
    check(await db().from("orders").update({ notified_at: nowIso() }).eq("id", id));
  },

  getOrder: one,
  async getOrderByToken(token) {
    const data = check(await db().from("orders").select("*").eq("public_token", token).maybeSingle());
    return data ? toOrder(data) : null;
  },
  async listOrders(friday) {
    const rows = rowsOf(await db().from("orders").select("*").eq("friday_date", friday).order("order_number"));
    return rows.map(toOrder);
  },
  async unitsTaken(friday, hold) {
    const orders = await this.listOrders(friday);
    const t = Date.now();
    return sumUnits(orders.filter((o) => holdsStock(o, t, hold)));
  },

  async updateStatus(id, status) {
    check(await db().from("orders").update({ status }).eq("id", id));
  },
  async requestCancellation(id, reason) {
    const rows = rowsOf(
      await db()
        .from("orders")
        .update({ status: "cancel_requested", cancel_requested_at: nowIso(), cancel_reason: reason })
        .eq("id", id)
        .in("status", ["paid", "preparing", "ready"])
        .select("*"),
    );
    return rows.length ? toOrder(rows[0]) : null;
  },

  async claimRefund(id) {
    const rows = rowsOf(
      await db()
        .from("orders")
        .update({ refund_started_at: nowIso() })
        .eq("id", id)
        .eq("payment_status", "paid")
        .is("refund_started_at", null)
        .is("refunded_at", null)
        .select("*"),
    );
    return rows.length ? toOrder(rows[0]) : null;
  },
  async completeRefund(id, amount, ref) {
    const order = await one(id);
    if (!order) return;
    check(
      await db()
        .from("orders")
        .update({
          refund_agorot: amount,
          refund_ref: ref,
          refunded_at: nowIso(),
          payment_status: amount >= order.totalAgorot ? "refunded" : "partially_refunded",
          status: "cancelled",
        })
        .eq("id", id),
    );
  },
  async releaseRefund(id) {
    check(await db().from("orders").update({ refund_started_at: null }).eq("id", id).is("refunded_at", null));
  },
};
