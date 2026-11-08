import "server-only";
import { randomBytes } from "node:crypto";
import { DRINKS, MAX_QTY_PER_LINE, PAYMENT_HOLD_MINUTES } from "./config";
import { getOrderingCycle, type OrderingCycle } from "./cycle";
import { getStore } from "./store";
import { getPaymentProvider } from "./payments";
import { PaymentNotConfiguredError, type PaymentProvider, type VerifiedPaymentEvent } from "./payments/types";
import { sendOrderConfirmation } from "./messaging";
import { quoteCancellation } from "./cancellation";
import { cleanText, isUuidLike, normalizeIsraeliPhone } from "./validation";
import type { DrinkId, FridayOverride, Fulfillment, Order, OrderItem, Product, ProductId, Settings } from "./types";

export interface Storefront {
  settings: Settings;
  products: Product[];
  overrides: FridayOverride[];
  cycle: OrderingCycle;
  /** Units still available for the open Friday (null = unlimited). */
  remaining: Partial<Record<ProductId, number | null>>;
}

export async function loadStorefront(now = new Date()): Promise<Storefront> {
  const store = getStore();
  const [settings, products, overrides] = await Promise.all([store.getSettings(), store.getProducts(), store.getOverrides()]);
  const cycle = getOrderingCycle(now, settings, overrides);
  const remaining: Storefront["remaining"] = {};
  const limited = products.filter((p) => p.weeklyLimit != null);
  if (cycle.fridayDate && limited.length) {
    const taken = await store.unitsTaken(cycle.fridayDate, PAYMENT_HOLD_MINUTES);
    for (const p of limited) remaining[p.id] = Math.max(0, p.weeklyLimit! - (taken[p.id] ?? 0));
  }
  for (const p of products) if (!(p.id in remaining)) remaining[p.id] = null;
  return { settings, products, overrides, cycle, remaining };
}

// ───────────────────────── checkout ─────────────────────────

export interface CheckoutInput {
  idempotencyKey: unknown;
  fridayDate: unknown;
  items: unknown;
  fulfillment: unknown;
  customerName: unknown;
  phone: unknown;
  address?: unknown;
  apartment?: unknown;
  floor?: unknown;
  deliveryNotes?: unknown;
  acceptedTerms: unknown;
}

export type CheckoutResult =
  | { ok: true; redirectUrl: string }
  | { ok: false; code: string; message: string; field?: string; fridayDate?: string | null };

const fail = (code: string, message: string, field?: string): CheckoutResult => ({ ok: false, code, message, field });

export async function createCheckout(input: CheckoutInput, origin: string): Promise<CheckoutResult> {
  if (!isUuidLike(input.idempotencyKey)) return fail("bad_request", "משהו השתבש. נסו לרענן את העמוד.");

  let provider: PaymentProvider;
  try {
    provider = getPaymentProvider();
  } catch (e) {
    if (e instanceof PaymentNotConfiguredError) return fail("payments_unavailable", "התשלום עדיין לא זמין. נסו שוב מאוחר יותר.");
    throw e;
  }

  const store = getStore();
  const now = new Date();
  const [settings, products, overrides] = await Promise.all([store.getSettings(), store.getProducts(), store.getOverrides()]);
  const cycle = getOrderingCycle(now, settings, overrides);

  if (!cycle.open || !cycle.fridayDate) return fail("closed", "ההזמנות סגורות כרגע.");
  if (input.fridayDate !== cycle.fridayDate) {
    return { ok: false, code: "friday_changed", message: "ההזמנות לשישי הקרוב נסגרו. אפשר כבר להזמין לשישי הבא.", fridayDate: cycle.fridayDate };
  }

  // Items — prices always come from the database, never from the client.
  if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > 10) return fail("empty", "ההזמנה ריקה.");
  const merged = new Map<string, OrderItem>();
  for (const raw of input.items as Array<Record<string, unknown>>) {
    const product = products.find((p) => p.id === raw?.productId);
    if (!product) return fail("bad_item", "אחד המוצרים כבר לא קיים. רעננו את העמוד.");
    if (!product.available) return fail("unavailable", `${product.name} לא זמין השבוע.`);
    const qty = Number(raw.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) return fail("bad_qty", "כמות לא תקינה.");
    let drink: DrinkId | null = null;
    if (product.requiresDrink) {
      const d = DRINKS.find((x) => x.id === raw.drink);
      if (!d) return fail("drink", "צריך לבחור שתייה לכל חלת שניצל.");
      drink = d.id;
    }
    const key = `${product.id}:${drink ?? ""}`;
    const prev = merged.get(key);
    merged.set(key, {
      productId: product.id,
      name: product.name,
      unitPriceAgorot: product.priceAgorot,
      drink,
      quantity: (prev?.quantity ?? 0) + qty,
    });
  }
  const items = [...merged.values()];
  if (items.some((i) => i.quantity > MAX_QTY_PER_LINE)) return fail("bad_qty", "כמות לא תקינה.");

  // Fulfillment
  const fulfillment = input.fulfillment as Fulfillment;
  let address: string | null = null;
  let apartment: string | null = null;
  let floor: string | null = null;
  let deliveryNotes: string | null = null;
  if (fulfillment === "pickup") {
    if (!settings.pickup.enabled) return fail("fulfillment", "איסוף עצמי לא זמין השבוע.");
  } else if (fulfillment === "delivery") {
    if (!settings.delivery.enabled || settings.delivery.addresses.length === 0) return fail("fulfillment", "משלוח לא זמין השבוע.");
    address = cleanText(input.address, 120) || (settings.delivery.addresses.length === 1 ? settings.delivery.addresses[0] : "");
    if (!settings.delivery.addresses.includes(address)) return fail("address", "המשלוח זמין רק לכתובות שברשימה.", "address");
    apartment = cleanText(input.apartment, 10);
    if (!/^[0-9]{1,4}[א-תa-zA-Z]?$/.test(apartment)) return fail("apartment", "נא למלא מספר דירה.", "apartment");
    floor = cleanText(input.floor, 4) || null;
    if (floor && !/^-?[0-9]{1,3}$/.test(floor)) return fail("floor", "קומה לא תקינה.", "floor");
    deliveryNotes = cleanText(input.deliveryNotes, 200) || null;
  } else {
    return fail("fulfillment", "נא לבחור איסוף או משלוח.");
  }

  const customerName = cleanText(input.customerName, 60);
  if (customerName.length < 2) return fail("name", "נא למלא שם מלא.", "customerName");
  const phone = normalizeIsraeliPhone(String(input.phone ?? ""));
  if (!phone) return fail("phone", "מספר הטלפון לא נראה תקין.", "phone");
  if (input.acceptedTerms !== true) return fail("terms", "צריך לאשר את מדיניות הביטול.", "acceptedTerms");

  const subtotal = items.reduce((s, i) => s + i.unitPriceAgorot * i.quantity, 0);
  const deliveryFee = fulfillment === "delivery" ? settings.delivery.feeAgorot : 0;

  const limits: Partial<Record<ProductId, number>> = {};
  for (const p of products) if (p.weeklyLimit != null) limits[p.id] = p.weeklyLimit;

  const result = await store.createPendingOrder(
    {
      publicToken: randomBytes(18).toString("base64url"),
      idempotencyKey: input.idempotencyKey,
      fridayDate: cycle.fridayDate,
      status: "pending_payment",
      paymentStatus: "pending",
      customerName,
      phone,
      fulfillment,
      address,
      apartment,
      floor,
      deliveryNotes,
      items,
      subtotalAgorot: subtotal,
      deliveryFeeAgorot: deliveryFee,
      totalAgorot: subtotal + deliveryFee,
      termsAcceptedAt: now.toISOString(),
      policySnapshot: settings.cancellation.policyText,
      paymentProvider: provider.id,
    },
    limits,
    PAYMENT_HOLD_MINUTES,
  );

  if (result.kind === "sold_out") {
    const name = products.find((p) => p.id === result.productId)?.name ?? "המוצר";
    return fail(
      "sold_out",
      result.remaining > 0 ? `נשארו רק ${result.remaining} יחידות של ${name} השבוע.` : `${name} אזל לשישי הזה.`,
    );
  }

  const order = result.order;
  if (result.kind === "existing") {
    // Double-click or retry with the same attempt: never create a second order.
    if (order.paymentStatus === "paid") return { ok: true, redirectUrl: `/order/${order.publicToken}` };
    if (order.status === "pending_payment" && order.paymentUrl) return { ok: true, redirectUrl: order.paymentUrl };
    if (order.status !== "pending_payment" && order.status !== "payment_failed") return fail("bad_request", "משהו השתבש. נסו לרענן את העמוד.");
  }

  const orderUrl = `${origin}/order/${order.publicToken}`;
  const { paymentUrl, providerRef } = await provider.createPayment({
    order,
    successUrl: orderUrl,
    cancelUrl: `${origin}/checkout?payment=cancelled`,
    webhookUrl: `${origin}/api/payments/webhook/${provider.id}`,
  });
  await store.setPaymentDetails(order.id, { paymentRef: providerRef, paymentUrl });
  return { ok: true, redirectUrl: paymentUrl };
}

// ───────────────────────── payment confirmation ─────────────────────────

/**
 * The ONLY place an order becomes paid. Called after the provider adapter has
 * verified the webhook. Idempotent: replays and duplicates are no-ops.
 */
export async function applyPaymentEvent(
  event: VerifiedPaymentEvent,
  origin: string,
  schedule: (task: () => Promise<void>) => void,
): Promise<{ status: "paid" | "duplicate" | "failed" | "ignored" }> {
  const store = getStore();
  const order = await store.getOrder(event.orderId);
  if (!order) return { status: "ignored" };

  if (event.outcome === "failed") {
    await store.markPaymentFailed(order.id);
    return { status: "failed" };
  }
  if (event.amountAgorot !== order.totalAgorot) {
    console.error("[payments] amount mismatch", order.orderNumber, event.amountAgorot, order.totalAgorot);
    return { status: "ignored" };
  }
  const paid = await store.markPaid(order.id, event.providerRef);
  if (!paid) return { status: "duplicate" };

  schedule(async () => {
    const settings = await store.getSettings();
    const sent = await sendOrderConfirmation(paid, settings, `${origin}/order/${paid.publicToken}`);
    if (sent) await store.markNotified(paid.id);
  });
  return { status: "paid" };
}

// ───────────────────────── cancellation & refunds ─────────────────────────

export async function customerRequestCancellation(token: string, reason: string): Promise<{ ok: boolean; message: string }> {
  const store = getStore();
  const order = await store.getOrderByToken(token);
  if (!order) return { ok: false, message: "ההזמנה לא נמצאה." };
  const updated = await store.requestCancellation(order.id, cleanText(reason, 300) || null);
  if (!updated) return { ok: false, message: "לא ניתן לבטל את ההזמנה הזו אונליין. אפשר לפנות אלינו." };
  return { ok: true, message: "בקשת הביטול התקבלה. נעדכן אתכם לגבי ההחזר." };
}

export async function processRefund(orderId: string, amountAgorot: number): Promise<{ ok: boolean; message: string }> {
  const store = getStore();
  const current = await store.getOrder(orderId);
  if (!current) return { ok: false, message: "הזמנה לא נמצאה" };
  if (!Number.isInteger(amountAgorot) || amountAgorot < 0 || amountAgorot > current.totalAgorot) {
    return { ok: false, message: "סכום החזר לא תקין" };
  }
  if (amountAgorot === 0) {
    await store.updateStatus(orderId, "cancelled");
    return { ok: true, message: "ההזמנה בוטלה ללא החזר" };
  }
  const claimed = await store.claimRefund(orderId);
  if (!claimed) return { ok: false, message: "כבר בוצע או מתבצע החזר להזמנה הזו" };
  try {
    const provider = getPaymentProvider(claimed.paymentProvider);
    const { refundRef } = await provider.refund({ order: claimed, amountAgorot });
    await store.completeRefund(orderId, amountAgorot, refundRef);
    return { ok: true, message: "ההחזר בוצע" };
  } catch (err) {
    await store.releaseRefund(orderId);
    console.error("[refund] failed", claimed.orderNumber, err);
    return { ok: false, message: err instanceof Error ? `ההחזר נכשל: ${err.message}` : "ההחזר נכשל" };
  }
}

export function quoteFor(order: Order, settings: Settings) {
  return quoteCancellation(order, settings, order.cancelRequestedAt ? new Date(order.cancelRequestedAt) : new Date());
}
