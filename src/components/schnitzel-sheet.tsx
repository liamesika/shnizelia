"use client";

import { useState } from "react";
import { DEFAULT_DRINK, DRINKS } from "@/lib/config";
import { cart } from "@/lib/cart";
import { formatILS } from "@/lib/money";
import type { DrinkId, Product } from "@/lib/types";
import { PrimaryButton, QtyStepper, Sheet } from "./ui";

function DrinkChips({ value, onChange, name, label }: { value: DrinkId; onChange: (d: DrinkId) => void; name: string; label: string }) {
  return (
    <fieldset>
      <legend className="sr-only">{label}</legend>
      <div className="grid grid-cols-3 gap-1.5">
        {DRINKS.map((d) => {
          const checked = value === d.id;
          return (
            <label
              key={d.id}
              className={`flex h-12 cursor-pointer items-center justify-center border text-[15px] font-medium transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-yolk ${
                checked ? "border-zaatar bg-zaatar text-white" : "border-line bg-card hover:border-ink"
              }`}
            >
              <input type="radio" name={name} value={d.id} checked={checked} onChange={() => onChange(d.id)} className="sr-only" />
              {d.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Sandwich customization: quantity + one drink per sandwich. Mounted fresh each time it opens. */
export function SchnitzelSheet({
  product,
  maxQty,
  onClose,
  onAdded,
}: {
  product: Product;
  maxQty: number;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [drinks, setDrinks] = useState<DrinkId[]>([DEFAULT_DRINK]);
  const qty = drinks.length;

  const setQty = (n: number) =>
    setDrinks((prev) => (n > prev.length ? [...prev, ...Array(n - prev.length).fill(DEFAULT_DRINK)] : prev.slice(0, n)));

  const add = () => {
    const counts = new Map<DrinkId, number>();
    for (const d of drinks) counts.set(d, (counts.get(d) ?? 0) + 1);
    for (const [d, n] of counts) cart.add(product.id, d, n);
    onAdded();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={product.name}
      subtitle={`${formatILS(product.priceAgorot)} לחלה, כולל שתייה`}
      footer={
        <PrimaryButton onClick={add} data-autofocus className="justify-between">
          <span>הוספה להזמנה</span>
          <span className="tabular font-num text-[24px] leading-none">{formatILS(product.priceAgorot * qty)}</span>
        </PrimaryButton>
      }
    >
      <div className="flex items-center justify-between border-y border-line py-4">
        <span className="text-[16px] font-bold">כמה חלות?</span>
        <QtyStepper value={qty} onChange={setQty} min={1} max={Math.max(1, maxQty)} label="חלת שניצל" />
      </div>

      <div className="space-y-4 pt-5">
        <p className="text-[16px] font-bold">{qty === 1 ? "איזו שתייה?" : "איזו שתייה לכל חלה?"}</p>
        {drinks.map((d, i) => (
          <div key={i} className="space-y-2">
            {qty > 1 && <p className="text-[13px] font-medium text-muted">חלה {i + 1}</p>}
            <DrinkChips
              value={d}
              name={`drink-${i}`}
              label={qty > 1 ? `שתייה לחלה ${i + 1}` : "שתייה"}
              onChange={(next) => setDrinks((prev) => prev.map((x, j) => (j === i ? next : x)))}
            />
          </div>
        ))}
      </div>
    </Sheet>
  );
}
