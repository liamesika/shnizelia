"use client";

import { useSyncExternalStore } from "react";
import { MAX_QTY_PER_LINE } from "./config";
import type { DrinkId, Fulfillment, ProductId } from "./types";

export interface CartLine {
  productId: ProductId;
  drink: DrinkId | null;
  quantity: number;
}

export interface CartDetails {
  customerName: string;
  phone: string;
  address: string;
  apartment: string;
  floor: string;
  deliveryNotes: string;
}

export interface CartState {
  lines: CartLine[];
  fulfillment: Fulfillment;
  details: CartDetails;
}

const KEY = "friday-cart-v1";
const EMPTY_DETAILS: CartDetails = { customerName: "", phone: "", address: "", apartment: "", floor: "", deliveryNotes: "" };
const EMPTY: CartState = { lines: [], fulfillment: "pickup", details: EMPTY_DETAILS };

let state: CartState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function read(): CartState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<CartState>;
    return {
      lines: Array.isArray(parsed.lines)
        ? parsed.lines.filter((l) => l && typeof l.quantity === "number" && l.quantity > 0)
        : [],
      fulfillment: parsed.fulfillment === "delivery" ? "delivery" : "pickup",
      details: { ...EMPTY_DETAILS, ...(parsed.details ?? {}) },
    };
  } catch {
    return EMPTY;
  }
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  state = read();
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      state = read();
      listeners.forEach((l) => l());
    }
  });
}

function set(next: CartState) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode — cart still works in memory */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  ensureLoaded();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCart(): CartState {
  return useSyncExternalStore(
    subscribe,
    () => {
      ensureLoaded();
      return state;
    },
    () => EMPTY,
  );
}

const same = (a: CartLine, productId: ProductId, drink: DrinkId | null) => a.productId === productId && a.drink === drink;

export const cart = {
  add(productId: ProductId, drink: DrinkId | null, quantity = 1) {
    const lines = [...state.lines];
    const i = lines.findIndex((l) => same(l, productId, drink));
    if (i >= 0) lines[i] = { ...lines[i], quantity: Math.min(MAX_QTY_PER_LINE, lines[i].quantity + quantity) };
    else lines.push({ productId, drink, quantity: Math.min(MAX_QTY_PER_LINE, quantity) });
    set({ ...state, lines });
  },
  setQuantity(productId: ProductId, drink: DrinkId | null, quantity: number) {
    const q = Math.max(0, Math.min(MAX_QTY_PER_LINE, quantity));
    const lines = state.lines
      .map((l) => (same(l, productId, drink) ? { ...l, quantity: q } : l))
      .filter((l) => l.quantity > 0);
    set({ ...state, lines });
  },
  /** Drops lines for products that no longer exist / are unavailable. */
  prune(validIds: ProductId[]) {
    const lines = state.lines.filter((l) => validIds.includes(l.productId));
    if (lines.length !== state.lines.length) set({ ...state, lines });
  },
  setFulfillment(fulfillment: Fulfillment) {
    set({ ...state, fulfillment });
  },
  setDetails(patch: Partial<CartDetails>) {
    set({ ...state, details: { ...state.details, ...patch } });
  },
  clearItems() {
    set({ ...state, lines: [] });
  },
};

export function cartCount(lines: CartLine[]) {
  return lines.reduce((s, l) => s + l.quantity, 0);
}
