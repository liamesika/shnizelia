"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { cart, cartCount, useCart } from "@/lib/cart";
import { formatILS } from "@/lib/money";
import { totals, type PublicConfig } from "@/lib/public-config";
import { shortDateHe, weekdayHe } from "@/lib/time";
import type { Product } from "@/lib/types";
import { ProductImage } from "./product-image";
import { SchnitzelSheet } from "./schnitzel-sheet";
import { CartLines } from "./cart-lines";
import { FulfillmentPicker, effectiveFulfillment } from "./fulfillment-picker";
import { BagIcon, Sheet, SummaryRow } from "./ui";

/** Real photos from previous Fridays. Decorative strip — product photos carry the alt text. */
const STRIP = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `/gallery/${n}.jpg`);

export function Storefront({ config, openCart }: { config: PublicConfig; openCart?: boolean }) {
  const state = useCart();
  const [sheetProduct, setSheetProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(!!openCart);
  const [justAdded, setJustAdded] = useState<Product["id"] | null>(null);
  const addedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { cycle } = config;
  const count = cartCount(state.lines);
  const fulfillment = effectiveFulfillment(state.fulfillment, config);
  const { subtotal, deliveryFee, total } = totals(state.lines, config, fulfillment);
  const cartVisible = cartOpen && count > 0;

  useEffect(() => {
    cart.prune(config.products.filter((p) => p.available).map((p) => p.id));
  }, [config.products]);

  useEffect(() => () => clearTimeout(addedTimer.current), []);

  const flashAdded = (id: Product["id"]) => {
    setJustAdded(id);
    clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setJustAdded(null), 1400);
  };

  const closeSheet = useCallback(() => setSheetProduct(null), []);
  const closeCart = useCallback(() => setCartOpen(false), []);

  const inCart = (id: Product["id"]) => state.lines.filter((l) => l.productId === id).reduce((s, l) => s + l.quantity, 0);
  const maxFor = (p: Product) => {
    const r = config.remaining[p.id];
    return r == null ? 20 : Math.max(0, r - inCart(p.id));
  };

  const onAdd = (p: Product) => {
    if (p.requiresDrink) setSheetProduct(p);
    else {
      cart.add(p.id, null, 1);
      flashAdded(p.id);
    }
  };

  const canOrder = cycle.open;
  const products = config.products.filter((p) => p.available);
  const cutoff = `${weekdayHe(config.cutoffWeekday)} ${config.cutoffTime}`;

  return (
    <>
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <span className="font-display text-[24px] leading-none">{config.brandName}</span>
        <button
          type="button"
          onClick={() => count > 0 && setCartOpen(true)}
          className="relative -m-2 grid size-12 place-items-center transition-colors hover:bg-sesame"
          aria-label={count > 0 ? `ההזמנה שלי, ${count} פריטים` : "ההזמנה ריקה"}
        >
          <BagIcon />
          {count > 0 && (
            <span key={count} className="bump tabular absolute top-1.5 left-1 grid min-w-5 place-items-center bg-yolk px-1 text-[12px] leading-5 font-bold text-ink">
              {count}
            </span>
          )}
        </button>
      </header>

      <main className={count > 0 ? "pb-24" : "pb-12"}>
        {/* Intro — headline + when this order is for */}
        <section className="mx-auto max-w-6xl px-5 pt-2 pb-6 sm:grid sm:grid-cols-[1fr_auto] sm:items-end sm:gap-12 sm:px-8 sm:pt-6 sm:pb-10">
          <h1 className="font-display text-[44px] leading-[1.02] sm:text-[84px]">
            <span className="rise-mask">
              <span style={{ "--d": "80ms" } as React.CSSProperties}>השישי שלכם,</span>
            </span>
            <span className="rise-mask">
              <span style={{ "--d": "200ms" } as React.CSSProperties}>מסודר.</span>
            </span>
          </h1>
          <div className="rise mt-4 sm:mt-0 sm:max-w-md sm:pb-3" style={{ "--d": "380ms" } as React.CSSProperties}>
            <p className="text-[16px] leading-snug text-muted sm:mb-5 sm:text-[19px]">חלת שניצל, חלות לשבת — והכול טרי, בהזמנה מראש.</p>
            <OrderWindow config={config} cutoff={cutoff} />
          </div>
        </section>

        {/* Photo strip from previous Fridays */}
        <div className="strip rise overflow-hidden" dir="ltr" style={{ "--d": "480ms" } as React.CSSProperties} aria-hidden="true">
          <div className="strip-track flex w-max gap-1" dir="ltr">
            {[...STRIP, ...STRIP].map((src, i) => (
              <div key={i} className="relative h-28 shrink-0 sm:h-44" style={{ aspectRatio: i % 3 === 0 ? "3/4" : i % 3 === 1 ? "1/1" : "4/3" }}>
                <Image src={src} alt="" fill sizes="240px" className="object-cover" loading={i < 6 ? "eager" : "lazy"} />
              </div>
            ))}
          </div>
        </div>

        {/* Products */}
        <section aria-label="מוצרים" className="mx-auto max-w-6xl sm:px-8 sm:pt-10">
          {products.length === 0 ? (
            <p className="px-5 py-16 text-center text-[17px] text-muted">אין מוצרים זמינים כרגע.</p>
          ) : (
            <div className="grid sm:grid-cols-2 sm:gap-8">
              {products.map((p, i) => {
                const soldOut = config.remaining[p.id] === 0;
                const qty = inCart(p.id);
                const added = justAdded === p.id;
                const disabled = !canOrder || soldOut || maxFor(p) === 0;
                return (
                  <article
                    key={p.id}
                    className="rise border-b border-line pb-8 sm:border-b-0 sm:pb-0"
                    style={{ "--d": `${560 + i * 120}ms` } as React.CSSProperties}
                  >
                    <div className="settle relative aspect-square overflow-hidden bg-sesame sm:aspect-[4/5]" style={{ "--d": `${560 + i * 120}ms` } as React.CSSProperties}>
                      <ProductImage src={p.image} alt={p.imageAlt || p.name} priority={i === 0} />
                      <span className="tabular absolute right-0 bottom-0 bg-yolk px-4 pt-2 pb-1 font-num text-[32px] leading-none text-ink sm:text-[38px]">
                        {formatILS(p.priceAgorot)}
                      </span>
                      {soldOut && (
                        <span className="absolute top-0 left-0 bg-ink px-3 py-1.5 text-[14px] font-bold text-white">אזל לשישי הזה</span>
                      )}
                    </div>
                    <div className="px-5 pt-4 sm:px-0 sm:pt-5">
                      <h2 className="font-display text-[30px] leading-[1.1] sm:text-[34px]">{p.name}</h2>
                      <p className="mt-1.5 text-[16px] text-muted sm:text-[17px]">{p.description}</p>
                      <button
                        type="button"
                        onClick={() => onAdd(p)}
                        disabled={disabled}
                        className={`group mt-5 flex h-14 w-full items-center justify-between px-5 text-[17px] font-semibold transition-colors disabled:cursor-not-allowed disabled:bg-[#c9c3b8] disabled:text-white ${
                          added ? "bg-yolk text-ink" : "bg-zaatar text-white hover:bg-zaatar-deep"
                        }`}
                      >
                        <span aria-live="polite">{soldOut ? "אזל" : added ? "נוסף להזמנה ✓" : "הוספה להזמנה"}</span>
                        <span className="flex items-center gap-3">
                          {qty > 0 && !added && <span className="tabular text-[14px] font-medium opacity-80">{qty} בהזמנה</span>}
                          <span
                            className={`grid size-8 place-items-center text-[22px] leading-none transition-transform group-hover:rotate-90 ${added ? "bg-ink text-yolk" : "bg-white/15"}`}
                            aria-hidden="true"
                          >
                            +
                          </span>
                        </span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Sticky order bar */}
      {count > 0 && (
        <div className="bar-enter fixed inset-x-0 bottom-0 z-40 bg-zaatar text-white">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 pb-[env(safe-area-inset-bottom)] sm:px-8"
          >
            <span className="flex items-center gap-3 text-[17px] font-semibold">
              <span key={count} className="bump tabular grid size-8 place-items-center bg-yolk font-num text-[16px] text-ink">
                {count}
              </span>
              לצפייה בהזמנה
            </span>
            <span className="tabular font-num text-[26px] leading-none">{formatILS(total)}</span>
          </button>
        </div>
      )}

      {sheetProduct && (
        <SchnitzelSheet
          product={sheetProduct}
          maxQty={maxFor(sheetProduct)}
          onClose={closeSheet}
          onAdded={() => {
            const id = sheetProduct.id;
            setSheetProduct(null);
            flashAdded(id);
          }}
        />
      )}

      <Sheet
        open={cartVisible}
        onClose={closeCart}
        title="ההזמנה שלך"
        subtitle={cycle.fridayDate ? `לשישי ${shortDateHe(cycle.fridayDate)}` : undefined}
        footer={
          canOrder ? (
            <Link
              href="/checkout"
              className="flex h-14 w-full items-center justify-between bg-zaatar px-5 text-[17px] font-semibold text-white transition-colors hover:bg-zaatar-deep"
            >
              <span>להמשך הזמנה</span>
              <span className="tabular font-num text-[24px] leading-none">{formatILS(total)}</span>
            </Link>
          ) : (
            <p className="py-2 text-center text-[15px] text-muted">ההזמנות סגורות כרגע.</p>
          )
        }
      >
        <CartLines lines={state.lines} config={config} />
        <div className="mt-5">
          <FulfillmentPicker value={fulfillment} onChange={cart.setFulfillment} config={config} />
        </div>
        <div className="mt-5 space-y-2">
          <SummaryRow label="סכום ביניים" agorot={subtotal} />
          {fulfillment === "delivery" && <SummaryRow label="משלוח" agorot={deliveryFee} />}
          <SummaryRow label="סה״כ לתשלום" agorot={total} strong />
        </div>
      </Sheet>
    </>
  );
}

function OrderWindow({ config, cutoff }: { config: PublicConfig; cutoff: string }) {
  const { cycle } = config;

  if (!cycle.open) {
    return (
      <p className="mt-5 inline-block bg-ink px-4 py-3 text-[15px] font-medium text-white sm:mt-0">
        {cycle.closedReason === "paused" ? "ההזמנות סגורות כרגע. נחזור בקרוב." : "אין כרגע שישי פתוח להזמנות. נחזור בקרוב."}
      </p>
    );
  }
  return (
    <div className="mt-5 sm:mt-0">
      {cycle.rolledOver && (
        <p className="mb-2 bg-yolk px-3 py-2 text-[14px] font-medium text-ink">ההזמנות לשישי הקרוב נסגרו. אפשר כבר להזמין לשישי הבא.</p>
      )}
      <div className="flex items-stretch">
        <span className="flex items-center bg-zaatar px-4 py-2 font-display text-[20px] leading-none text-white">
          שישי {shortDateHe(cycle.fridayDate!)}
        </span>
        <span className="flex items-center bg-sesame px-4 py-2 text-[14px] leading-tight">
          הזמנות עד
          <br />
          {cutoff}
        </span>
      </div>
    </div>
  );
}
