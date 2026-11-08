import { ACTIVE_STATUSES, type Order, type ProductId } from "../types";

/** Does this order currently consume stock? Paid orders always; pending ones only within the hold window. */
export function holdsStock(order: Order, now: number, holdMinutes: number): boolean {
  if (ACTIVE_STATUSES.includes(order.status)) return true;
  if (order.status === "pending_payment") {
    return now - new Date(order.createdAt).getTime() < holdMinutes * 60_000;
  }
  return false;
}

export function sumUnits(orders: Order[]): Partial<Record<ProductId, number>> {
  const out: Partial<Record<ProductId, number>> = {};
  for (const o of orders) for (const i of o.items) out[i.productId] = (out[i.productId] ?? 0) + i.quantity;
  return out;
}

export const PAYABLE_FROM: Order["status"][] = ["pending_payment", "payment_failed"];
