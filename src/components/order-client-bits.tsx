"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cart } from "@/lib/cart";

/** Re-checks the order while the payment webhook hasn't arrived yet. */
export function PendingPoller({ intervalMs = 2500, maxTries = 48 }: { intervalMs?: number; maxTries?: number }) {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (tries > maxTries) {
        clearInterval(t);
        setGaveUp(true);
        return;
      }
      router.refresh();
    }, intervalMs);
    return () => clearInterval(t);
  }, [router, intervalMs, maxTries]);
  return gaveUp ? (
    <p className="mt-3 text-[14px] text-muted">לוקח יותר זמן מהרגיל. אם חויבתם ולא קיבלתם אישור — צרו איתנו קשר ונבדוק.</p>
  ) : null;
}

/** Empties the cart once the order is confirmed paid (keeps name/phone for next week). */
export function ClearCartOnce() {
  useEffect(() => {
    cart.clearItems();
    try {
      sessionStorage.removeItem("friday-checkout-attempt");
    } catch {}
  }, []);
  return null;
}
