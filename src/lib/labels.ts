import type { OrderStatus, PaymentStatus } from "./types";

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "ממתין לתשלום",
  paid: "שולם",
  preparing: "בהכנה",
  ready: "מוכן",
  completed: "נמסר",
  cancel_requested: "בקשת ביטול",
  cancelled: "בוטל",
  payment_failed: "תשלום נכשל",
};

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  pending: "ממתין",
  paid: "שולם",
  failed: "נכשל",
  refunded: "הוחזר",
  partially_refunded: "הוחזר חלקית",
};

/** Statuses an admin may set manually. Payment-driven statuses are set by the system only. */
export const ADMIN_SETTABLE: OrderStatus[] = ["paid", "preparing", "ready", "completed"];
