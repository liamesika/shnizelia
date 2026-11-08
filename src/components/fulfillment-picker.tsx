"use client";

import { formatILS } from "@/lib/money";
import { deliveryAvailable, type PublicConfig } from "@/lib/public-config";
import type { Fulfillment } from "@/lib/types";

export function effectiveFulfillment(chosen: Fulfillment, c: PublicConfig): Fulfillment {
  if (chosen === "delivery" && !deliveryAvailable(c)) return "pickup";
  if (chosen === "pickup" && !c.pickup.enabled && deliveryAvailable(c)) return "delivery";
  return chosen;
}

export function FulfillmentPicker({
  value,
  onChange,
  config,
}: {
  value: Fulfillment;
  onChange: (f: Fulfillment) => void;
  config: PublicConfig;
}) {
  const options: { id: Fulfillment; label: string; price: string; enabled: boolean }[] = [
    { id: "pickup", label: "איסוף עצמי", price: "ללא עלות", enabled: config.pickup.enabled },
    { id: "delivery", label: "משלוח עד הבית", price: formatILS(config.delivery.feeAgorot), enabled: deliveryAvailable(config) },
  ];
  const visible = options.filter((o) => o.enabled);
  if (visible.length === 0) return null;

  return (
    <fieldset>
      <legend className="mb-2 text-[16px] font-bold">איך תרצו לקבל?</legend>
      <div className={`grid gap-1.5 ${visible.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {visible.map((o) => {
          const checked = value === o.id;
          return (
            <label
              key={o.id}
              className={`relative flex min-h-[72px] cursor-pointer flex-col justify-center border-2 px-4 py-3 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-yolk ${
                checked ? "border-zaatar bg-zaatar text-white" : "border-line bg-card hover:border-ink"
              }`}
            >
              <input
                type="radio"
                name="fulfillment"
                value={o.id}
                checked={checked}
                onChange={() => onChange(o.id)}
                className="sr-only"
              />
              <span className="text-[15px] font-medium">{o.label}</span>
              <span className={`tabular text-[14px] ${checked ? "text-white/80" : "text-muted"}`}>{o.price}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
