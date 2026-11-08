export type ProductId = "schnitzel" | "challah";
export type DrinkId = "cola" | "zero" | "soda";
export type Fulfillment = "pickup" | "delivery";

export interface Drink {
  id: DrinkId;
  label: string;
}

export interface Product {
  id: ProductId;
  name: string;
  description: string;
  /** Price in agorot (₪1 = 100). Integers only, never floats. */
  priceAgorot: number;
  image: string;
  imageAlt: string;
  available: boolean;
  /** Max units per Friday. null = unlimited. */
  weeklyLimit: number | null;
  requiresDrink: boolean;
  sortOrder: number;
}

export interface Settings {
  brandName: string;
  /** Master switch — when false nobody can order for any Friday. */
  orderingOpen: boolean;
  /** Weekday (0=Sunday … 4=Thursday) and local time of the weekly order cutoff. */
  cutoffWeekday: number;
  cutoffTime: string; // "HH:MM", Asia/Jerusalem
  /** How many Fridays ahead the site may roll to when one is closed/past. */
  weeksAhead: number;
  pickup: {
    enabled: boolean;
    /** Shown on the confirmation page. Left empty until the owner fills it in. */
    locationText: string;
    hoursText: string;
  };
  delivery: {
    enabled: boolean;
    feeAgorot: number;
    /** The only addresses delivery is allowed to. Empty list = delivery unavailable. */
    addresses: string[];
    hoursText: string;
  };
  cancellation: {
    freeUntilWeekday: number;
    freeUntilTime: string;
    lateFeePercent: number;
    /**
     * Must stay false until the policy is legally reviewed. While false, late
     * cancellations are never charged automatically — they go to manual review.
     */
    lateFeeApproved: boolean;
    /** The exact policy shown before payment and stored with each order. */
    policyText: string;
  };
  supportPhone: string;
}

export interface FridayOverride {
  date: string; // YYYY-MM-DD
  closed: boolean;
  note: string;
}

export interface OrderItem {
  productId: ProductId;
  name: string;
  unitPriceAgorot: number;
  quantity: number;
  drink: DrinkId | null;
}

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "preparing"
  | "ready"
  | "completed"
  | "cancel_requested"
  | "cancelled"
  | "payment_failed";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "partially_refunded";

export interface Order {
  id: string;
  orderNumber: number;
  publicToken: string;
  idempotencyKey: string;
  fridayDate: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  customerName: string;
  phone: string;
  fulfillment: Fulfillment;
  address: string | null;
  apartment: string | null;
  floor: string | null;
  deliveryNotes: string | null;
  items: OrderItem[];
  subtotalAgorot: number;
  deliveryFeeAgorot: number;
  totalAgorot: number;
  termsAcceptedAt: string;
  policySnapshot: string;
  paymentProvider: string;
  paymentRef: string | null;
  paymentUrl: string | null;
  paidAt: string | null;
  cancelRequestedAt: string | null;
  cancelReason: string | null;
  refundStartedAt: string | null;
  refundAgorot: number | null;
  refundRef: string | null;
  refundedAt: string | null;
  notifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NewOrder = Omit<
  Order,
  | "id"
  | "orderNumber"
  | "createdAt"
  | "updatedAt"
  | "paymentRef"
  | "paymentUrl"
  | "paidAt"
  | "cancelRequestedAt"
  | "cancelReason"
  | "refundStartedAt"
  | "refundAgorot"
  | "refundRef"
  | "refundedAt"
  | "notifiedAt"
>;

/** Statuses that count as real, paid, not-cancelled orders. */
export const ACTIVE_STATUSES: OrderStatus[] = ["paid", "preparing", "ready", "completed", "cancel_requested"];
