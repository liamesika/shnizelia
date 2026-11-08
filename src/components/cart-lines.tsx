"use client";

import { DRINKS } from "@/lib/config";
import { cart, type CartLine } from "@/lib/cart";
import { formatILS } from "@/lib/money";
import type { PublicConfig } from "@/lib/public-config";
import { QtyStepper } from "./ui";

export function drinkLabel(id: string | null) {
  return id ? DRINKS.find((d) => d.id === id)?.label ?? "" : "";
}

export function CartLines({ lines, config, editable = true }: { lines: CartLine[]; config: PublicConfig; editable?: boolean }) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {lines.map((l) => {
        const p = config.products.find((x) => x.id === l.productId);
        if (!p) return null;
        const name = l.drink ? `${p.name.replace(/ \+ שתייה$/, "")}` : p.name;
        return (
          <li key={`${l.productId}:${l.drink}`} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-semibold">{name}</p>
              <p className="text-[13px] text-muted">
                {l.drink ? `עם ${drinkLabel(l.drink)} · ` : ""}
                <span className="tabular">{formatILS(p.priceAgorot)}</span>
                {!editable && <> · ×{l.quantity}</>}
              </p>
            </div>
            {editable && (
              <QtyStepper
                size="sm"
                value={l.quantity}
                onChange={(q) => cart.setQuantity(l.productId, l.drink, q)}
                label={l.drink ? `${name} עם ${drinkLabel(l.drink)}` : name}
              />
            )}
            <span className="tabular w-14 text-left font-num text-[19px] leading-none">{formatILS(p.priceAgorot * l.quantity)}</span>
          </li>
        );
      })}
    </ul>
  );
}
