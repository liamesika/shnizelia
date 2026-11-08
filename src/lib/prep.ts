import { ACTIVE_STATUSES, type DrinkId, type Order } from "./types";

export interface PrepSummary {
  orders: number;
  sandwiches: number;
  challahPairs: number;
  challahs: number;
  drinks: Record<DrinkId, number>;
  deliveries: number;
  pickups: number;
  revenueAgorot: number;
  pendingCancellations: number;
}

/** Only paid, valid, non-cancelled orders count toward what needs to be prepared. */
export function prepSummary(orders: Order[]): PrepSummary {
  const s: PrepSummary = {
    orders: 0,
    sandwiches: 0,
    challahPairs: 0,
    challahs: 0,
    drinks: { cola: 0, zero: 0, soda: 0 },
    deliveries: 0,
    pickups: 0,
    revenueAgorot: 0,
    pendingCancellations: 0,
  };
  for (const o of orders) {
    if (!ACTIVE_STATUSES.includes(o.status) || o.paymentStatus !== "paid") continue;
    s.orders++;
    if (o.status === "cancel_requested") s.pendingCancellations++;
    s.revenueAgorot += o.totalAgorot;
    if (o.fulfillment === "delivery") s.deliveries++;
    else s.pickups++;
    for (const i of o.items) {
      if (i.productId === "schnitzel") {
        s.sandwiches += i.quantity;
        if (i.drink) s.drinks[i.drink] += i.quantity;
      } else if (i.productId === "challah") {
        s.challahPairs += i.quantity;
        s.challahs += i.quantity * 2;
      }
    }
  }
  return s;
}
