import type { FridayOverride, NewOrder, Order, OrderStatus, Product, ProductId, Settings } from "../types";

export type CreateOrderResult =
  | { kind: "created"; order: Order }
  | { kind: "existing"; order: Order }
  | { kind: "sold_out"; productId: ProductId; remaining: number };

export interface Store {
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;

  getProducts(): Promise<Product[]>;
  saveProduct(product: Product): Promise<void>;

  getOverrides(): Promise<FridayOverride[]>;
  saveOverride(override: FridayOverride): Promise<void>;
  deleteOverride(date: string): Promise<void>;

  /**
   * Atomically: returns the existing order for this idempotency key, or checks
   * per-product weekly limits and inserts a pending_payment order.
   */
  createPendingOrder(order: NewOrder, limits: Partial<Record<ProductId, number>>, holdMinutes: number): Promise<CreateOrderResult>;

  setPaymentDetails(orderId: string, details: { paymentRef: string | null; paymentUrl: string | null }): Promise<void>;

  /** Moves pending → paid. Returns the order only if THIS call made the transition (idempotent). */
  markPaid(orderId: string, paymentRef: string | null): Promise<Order | null>;
  markPaymentFailed(orderId: string): Promise<void>;
  markNotified(orderId: string): Promise<void>;

  getOrder(id: string): Promise<Order | null>;
  getOrderByToken(token: string): Promise<Order | null>;
  listOrders(fridayDate: string): Promise<Order[]>;
  /** Units already sold/held per product for a Friday (for showing availability). */
  unitsTaken(fridayDate: string, holdMinutes: number): Promise<Partial<Record<ProductId, number>>>;

  updateStatus(orderId: string, status: OrderStatus): Promise<void>;
  requestCancellation(orderId: string, reason: string | null): Promise<Order | null>;

  /** Claims the refund lock. Returns null if a refund already started/finished. */
  claimRefund(orderId: string): Promise<Order | null>;
  completeRefund(orderId: string, amountAgorot: number, refundRef: string | null): Promise<void>;
  releaseRefund(orderId: string): Promise<void>;
}
