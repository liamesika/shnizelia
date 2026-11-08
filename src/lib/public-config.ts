import type { OrderingCycle } from "./cycle";
import type { Product, ProductId, Settings } from "./types";
import type { CartLine } from "./cart";

/** The subset of server data the browser needs. No secrets, no other customers' data. */
export interface PublicConfig {
  brandName: string;
  products: Product[];
  remaining: Partial<Record<ProductId, number | null>>;
  cycle: OrderingCycle;
  cutoffWeekday: number;
  cutoffTime: string;
  pickup: Settings["pickup"];
  delivery: Settings["delivery"];
  policyText: string;
  supportPhone: string;
}

export function toPublicConfig(s: {
  settings: Settings;
  products: Product[];
  remaining: PublicConfig["remaining"];
  cycle: OrderingCycle;
}): PublicConfig {
  return {
    brandName: s.settings.brandName,
    products: s.products,
    remaining: s.remaining,
    cycle: s.cycle,
    cutoffWeekday: s.settings.cutoffWeekday,
    cutoffTime: s.settings.cutoffTime,
    pickup: s.settings.pickup,
    delivery: s.settings.delivery,
    policyText: s.settings.cancellation.policyText,
    supportPhone: s.settings.supportPhone,
  };
}

export function deliveryAvailable(c: PublicConfig) {
  return c.delivery.enabled && c.delivery.addresses.length > 0;
}

/** Display totals. The server recalculates everything before charging. */
export function totals(lines: CartLine[], c: PublicConfig, fulfillment: "pickup" | "delivery") {
  const subtotal = lines.reduce((s, l) => {
    const p = c.products.find((x) => x.id === l.productId);
    return s + (p ? p.priceAgorot * l.quantity : 0);
  }, 0);
  const deliveryFee = fulfillment === "delivery" && deliveryAvailable(c) ? c.delivery.feeAgorot : 0;
  return { subtotal, deliveryFee, total: subtotal + deliveryFee };
}
