"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { assertAdmin, checkPassword, endAdminSession, startAdminSession } from "@/lib/admin-auth";
import { getStore } from "@/lib/store";
import { processRefund } from "@/lib/orders";
import { shekelsToAgorot } from "@/lib/money";
import { cleanText } from "@/lib/validation";
import { isFriday } from "@/lib/cycle";
import { ADMIN_SETTABLE } from "@/lib/labels";
import type { OrderStatus, ProductId, Settings } from "@/lib/types";

export type ActionState = { ok: boolean; message: string } | null;

// ── auth ──
const attempts = new Map<string, { n: number; until: number }>();

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const key = "global"; // single-owner admin: simple global throttle against guessing
  const a = attempts.get(key);
  if (a && a.until > Date.now()) return { ok: false, message: "יותר מדי ניסיונות. נסו שוב בעוד דקה." };
  if (!process.env.ADMIN_PASSWORD) return { ok: false, message: "ADMIN_PASSWORD לא הוגדר בשרת." };
  if (!checkPassword(String(formData.get("password") ?? ""))) {
    const n = (a?.n ?? 0) + 1;
    attempts.set(key, { n, until: n >= 5 ? Date.now() + 60_000 : 0 });
    return { ok: false, message: "סיסמה שגויה" };
  }
  attempts.delete(key);
  await startAdminSession();
  redirect("/admin");
}

export async function logout() {
  await endAdminSession();
  redirect("/admin/login");
}

// ── orders ──
export async function setOrderStatus(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as OrderStatus;
  if (!ADMIN_SETTABLE.includes(status)) throw new Error("Status not allowed");
  const order = await getStore().getOrder(id);
  if (!order || order.paymentStatus !== "paid") throw new Error("Only paid orders can change status");
  await getStore().updateStatus(id, status);
  refresh();
}

export async function refundOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await assertAdmin();
  const amount = shekelsToAgorot(String(formData.get("amount") ?? ""));
  if (amount == null) return { ok: false, message: "סכום לא תקין" };
  const result = await processRefund(String(formData.get("id")), amount);
  refresh();
  return result;
}

// ── settings ──
const bool = (f: FormData, k: string) => f.get(k) === "on";
const str = (f: FormData, k: string, max = 300) => cleanText(f.get(k), max);
const time = (v: string, fallback: string) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fallback);
const weekday = (v: string, fallback: number) => (/^[0-6]$/.test(v) ? Number(v) : fallback);

export async function saveSettings(_prev: ActionState, f: FormData): Promise<ActionState> {
  await assertAdmin();
  const store = getStore();
  const cur = await store.getSettings();
  const fee = shekelsToAgorot(str(f, "deliveryFee"));
  const pct = Number(str(f, "lateFeePercent"));
  const next: Settings = {
    brandName: str(f, "brandName", 40) || cur.brandName,
    orderingOpen: bool(f, "orderingOpen"),
    cutoffWeekday: weekday(str(f, "cutoffWeekday"), cur.cutoffWeekday),
    cutoffTime: time(str(f, "cutoffTime"), cur.cutoffTime),
    weeksAhead: Math.max(1, Math.min(6, Number(str(f, "weeksAhead")) || cur.weeksAhead)),
    pickup: {
      enabled: bool(f, "pickupEnabled"),
      locationText: str(f, "pickupLocation", 200),
      hoursText: str(f, "pickupHours", 200),
    },
    delivery: {
      enabled: bool(f, "deliveryEnabled"),
      feeAgorot: fee ?? cur.delivery.feeAgorot,
      addresses: String(f.get("deliveryAddresses") ?? "")
        .split("\n")
        .map((l) => cleanText(l, 120))
        .filter(Boolean)
        .slice(0, 30),
      hoursText: str(f, "deliveryHours", 200),
    },
    cancellation: {
      freeUntilWeekday: weekday(str(f, "freeUntilWeekday"), cur.cancellation.freeUntilWeekday),
      freeUntilTime: time(str(f, "freeUntilTime"), cur.cancellation.freeUntilTime),
      lateFeePercent: Number.isFinite(pct) && pct >= 0 && pct <= 100 ? pct : cur.cancellation.lateFeePercent,
      lateFeeApproved: bool(f, "lateFeeApproved"),
      policyText: String(f.get("policyText") ?? "").trim().slice(0, 1000) || cur.cancellation.policyText,
    },
    supportPhone: str(f, "supportPhone", 20),
  };
  if (!next.pickup.enabled && !(next.delivery.enabled && next.delivery.addresses.length)) {
    return { ok: false, message: "צריך להשאיר לפחות איסוף עצמי או משלוח עם כתובת אחת." };
  }
  await store.saveSettings(next);
  refresh();
  return { ok: true, message: "נשמר" };
}

export async function saveProduct(_prev: ActionState, f: FormData): Promise<ActionState> {
  await assertAdmin();
  const store = getStore();
  const id = String(f.get("id")) as ProductId;
  const product = (await store.getProducts()).find((p) => p.id === id);
  if (!product) return { ok: false, message: "מוצר לא נמצא" };
  const price = shekelsToAgorot(str(f, "price"));
  if (price == null || price <= 0) return { ok: false, message: "מחיר לא תקין" };
  const limitRaw = str(f, "weeklyLimit");
  const limit = limitRaw === "" ? null : Number(limitRaw);
  if (limit !== null && (!Number.isInteger(limit) || limit < 0)) return { ok: false, message: "מלאי לא תקין" };
  const image = str(f, "image", 500);
  if (image && !/^(\/|https:\/\/)/.test(image)) return { ok: false, message: "כתובת תמונה צריכה להתחיל ב-/ או https://" };
  await store.saveProduct({
    ...product,
    name: str(f, "name", 60) || product.name,
    description: str(f, "description", 160),
    priceAgorot: price,
    image: image || product.image,
    imageAlt: str(f, "imageAlt", 120),
    available: bool(f, "available"),
    weeklyLimit: limit,
  });
  refresh();
  return { ok: true, message: "נשמר" };
}

export async function setFridayOverride(formData: FormData) {
  await assertAdmin();
  const date = String(formData.get("date"));
  if (!isFriday(date)) throw new Error("Not a Friday");
  if (formData.get("mode") === "open") await getStore().deleteOverride(date);
  else await getStore().saveOverride({ date, closed: true, note: cleanText(formData.get("note"), 100) });
  refresh();
}
