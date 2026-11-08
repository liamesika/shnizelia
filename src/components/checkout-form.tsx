"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { cart, cartCount, useCart } from "@/lib/cart";
import { formatILS } from "@/lib/money";
import { deliveryAvailable, totals, type PublicConfig } from "@/lib/public-config";
import { longDateHe } from "@/lib/time";
import { normalizeIsraeliPhone } from "@/lib/validation";
import { CartLines } from "./cart-lines";
import { FulfillmentPicker, effectiveFulfillment } from "./fulfillment-picker";
import { PrimaryButton, Spinner, SummaryRow } from "./ui";

const noopSubscribe = () => () => {};
const ATTEMPT_KEY = "friday-checkout-attempt";

/** Same payload → same idempotency key (no duplicate orders on double click / retry). Changed payload → new key. */
function attemptKey(payloadHash: string): string {
  try {
    const saved = JSON.parse(sessionStorage.getItem(ATTEMPT_KEY) ?? "null") as { key: string; hash: string } | null;
    if (saved && saved.hash === payloadHash) return saved.key;
    const key = crypto.randomUUID();
    sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify({ key, hash: payloadHash }));
    return key;
  } catch {
    return crypto.randomUUID();
  }
}

type Errors = Partial<Record<"customerName" | "phone" | "address" | "apartment" | "acceptedTerms", string>>;

export function CheckoutForm({ config, paymentCancelled }: { config: PublicConfig; paymentCancelled: boolean }) {
  const router = useRouter();
  const state = useCart();
  const { details } = state;
  const fulfillment = effectiveFulfillment(state.fulfillment, config);
  const { subtotal, deliveryFee, total } = totals(state.lines, config, fulfillment);
  const count = cartCount(state.lines);
  const addresses = config.delivery.addresses;

  const [accepted, setAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const [formError, setFormError] = useState(paymentCancelled ? "התשלום בוטל ולא חויבתם. אפשר לנסות שוב." : "");
  const [submitting, setSubmitting] = useState(false);
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (fulfillment === "delivery" && addresses.length === 1 && details.address !== addresses[0]) {
      cart.setDetails({ address: addresses[0] });
    }
  }, [fulfillment, addresses, details.address]);

  if (hydrated && count === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-[17px] font-medium">ההזמנה ריקה</p>
        <Link href="/" className="mt-4 inline-block text-[15px] underline underline-offset-4">
          חזרה לבחירת מוצרים
        </Link>
      </div>
    );
  }

  function validate(): Errors {
    const e: Errors = {};
    if (details.customerName.trim().length < 2) e.customerName = "נא למלא שם מלא";
    if (!normalizeIsraeliPhone(details.phone)) e.phone = "נא למלא מספר טלפון תקין";
    if (fulfillment === "delivery") {
      if (!addresses.includes(details.address)) e.address = "נא לבחור כתובת";
      if (!/^[0-9]{1,4}[א-תa-zA-Z]?$/.test(details.apartment.trim())) e.apartment = "נא למלא מספר דירה";
    }
    if (!accepted) e.acceptedTerms = "צריך לאשר את מדיניות הביטול";
    return e;
  }

  // After the first submit attempt, errors update live as the customer fixes fields.
  const errors: Errors = { ...(submitted ? validate() : {}), ...serverErrors };

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (submitting) return;
    const e = validate();
    setSubmitted(true);
    setServerErrors({});
    if (Object.keys(e).length) {
      setFormError("");
      const first = Object.keys(e)[0];
      document.getElementById(`f-${first}`)?.focus();
      return;
    }

    const payload = {
      fridayDate: config.cycle.fridayDate,
      items: state.lines.map((l) => ({ productId: l.productId, drink: l.drink, quantity: l.quantity })),
      fulfillment,
      customerName: details.customerName.trim(),
      phone: details.phone,
      ...(fulfillment === "delivery"
        ? { address: details.address, apartment: details.apartment.trim(), floor: details.floor.trim(), deliveryNotes: details.deliveryNotes.trim() }
        : {}),
      acceptedTerms: true,
    };
    const idempotencyKey = attemptKey(JSON.stringify(payload));

    setSubmitting(true);
    setFormError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, idempotencyKey }),
      });
      const data = (await res.json()) as { ok: boolean; redirectUrl?: string; message?: string; field?: string; code?: string };
      if (data.ok && data.redirectUrl) {
        window.location.assign(data.redirectUrl);
        return; // keep the button disabled while navigating
      }
      setFormError(data.message ?? "משהו השתבש. נסו שוב.");
      if (data.field) setServerErrors({ [data.field]: data.message } as Errors);
      if (data.code === "friday_changed" || data.code === "sold_out" || data.code === "unavailable") router.refresh();
      setSubmitting(false);
      requestAnimationFrame(() => errorRef.current?.focus());
    } catch {
      setFormError("אין חיבור כרגע. בדקו את האינטרנט ונסו שוב — לא חויבתם.");
      setSubmitting(false);
    }
  }

  const closed = !config.cycle.open;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6 pb-36">
      {config.cycle.fridayDate && (
        <p className="inline-block bg-zaatar px-3 py-1.5 text-[14px] font-medium text-white">
          הזמנה ל{longDateHe(config.cycle.fridayDate)}
          {config.cycle.rolledOver && " · ההזמנות לשישי הקרוב נסגרו"}
        </p>
      )}

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[24px] leading-none">ההזמנה</h2>
          <Link href="/?cart=1" className="text-[14px] text-muted underline underline-offset-4 hover:text-ink">
            עריכה
          </Link>
        </div>
        {hydrated ? <CartLines lines={state.lines} config={config} editable={false} /> : <div className="h-16" />}
      </Card>

      <Card>
        <FulfillmentPicker value={fulfillment} onChange={cart.setFulfillment} config={config} />
        {fulfillment === "pickup" && (config.pickup.locationText || config.pickup.hoursText) && (
          <p className="mt-3 text-[14px] text-muted">
            {[config.pickup.locationText, config.pickup.hoursText].filter(Boolean).join(" · ")}
          </p>
        )}
        {fulfillment === "delivery" && deliveryAvailable(config) && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {addresses.length > 1 ? (
              <Field label="כתובת" error={errors.address} className="col-span-2" id="f-address">
                {(p) => (
                  <select {...p} value={details.address} onChange={(e) => cart.setDetails({ address: e.target.value })}>
                    <option value="">בחירה…</option>
                    {addresses.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            ) : (
              <p className="col-span-2 text-[14px] text-muted">משלוח ל{addresses[0]}</p>
            )}
            <Field label="מספר דירה" error={errors.apartment} id="f-apartment">
              {(p) => (
                <input
                  {...p}
                  inputMode="numeric"
                  autoComplete="off"
                  value={details.apartment}
                  onChange={(e) => cart.setDetails({ apartment: e.target.value })}
                />
              )}
            </Field>
            <Field label="קומה" optional id="f-floor">
              {(p) => (
                <input {...p} inputMode="numeric" value={details.floor} onChange={(e) => cart.setDetails({ floor: e.target.value })} />
              )}
            </Field>
            <Field label="הערות לשליח" optional className="col-span-2" id="f-notes">
              {(p) => (
                <input {...p} value={details.deliveryNotes} maxLength={200} onChange={(e) => cart.setDetails({ deliveryNotes: e.target.value })} />
              )}
            </Field>
            {config.delivery.hoursText && <p className="col-span-2 text-[13px] text-muted">{config.delivery.hoursText}</p>}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 font-display text-[24px] leading-none">פרטים</h2>
        <div className="space-y-3">
          <Field label="שם מלא" error={errors.customerName} id="f-customerName">
            {(p) => (
              <input
                {...p}
                autoComplete="name"
                value={details.customerName}
                maxLength={60}
                onChange={(e) => cart.setDetails({ customerName: e.target.value })}
              />
            )}
          </Field>
          <Field label="מספר טלפון" error={errors.phone} id="f-phone" hint="לאישור ההזמנה">
            {(p) => (
              <input
                {...p}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                className={`${p.className} text-right`}
                placeholder="050-0000000"
                value={details.phone}
                onChange={(e) => cart.setDetails({ phone: e.target.value })}
              />
            )}
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-[24px] leading-none">מדיניות ביטול</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-muted">{config.policyText}</p>
        <label className="mt-3 flex cursor-pointer items-start gap-3">
          <input
            id="f-acceptedTerms"
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            aria-invalid={!!errors.acceptedTerms}
            aria-describedby={errors.acceptedTerms ? "err-terms" : undefined}
            className="mt-0.5 size-5 shrink-0 accent-[#2e4a2b]"
          />
          <span className="text-[15px]">קראתי ואני מאשר/ת את מדיניות הביטול</span>
        </label>
        {errors.acceptedTerms && (
          <p id="err-terms" className="mt-1.5 text-[13px] text-danger">
            {errors.acceptedTerms}
          </p>
        )}
      </Card>

      <Card>
        <div className="space-y-1.5">
          <SummaryRow label="מוצרים" agorot={subtotal} />
          {fulfillment === "delivery" && <SummaryRow label="משלוח" agorot={deliveryFee} />}
          <SummaryRow label="סה״כ לתשלום" agorot={total} strong />
        </div>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-md">
          {formError && (
            <p ref={errorRef} tabIndex={-1} role="alert" className="mb-2 text-center text-[14px] text-danger outline-none">
              {formError}
            </p>
          )}
          <PrimaryButton type="submit" disabled={submitting || closed || !hydrated} className={submitting || closed ? "" : "justify-between"}>
            {submitting ? (
              <>
                <Spinner /> מעבירים לתשלום…
              </>
            ) : closed ? (
              "ההזמנות סגורות"
            ) : (
              <>
                <span className="flex items-center gap-2">
                  <LockIcon /> לתשלום מאובטח
                </span>
                <span className="tabular font-num text-[24px] leading-none">{formatILS(total)}</span>
              </>
            )}
          </PrimaryButton>
        </div>
      </div>
    </form>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="border-t-2 border-ink pt-4 pb-2">{children}</section>;
}

const inputClass =
  "h-13 w-full border-2 border-line bg-card px-3.5 text-[16px] transition-colors placeholder:text-muted/60 hover:border-ink/40 focus:border-zaatar focus:outline-none aria-invalid:border-danger";

function Field({
  label,
  id,
  error,
  optional,
  hint,
  className = "",
  children,
}: {
  label: string;
  id: string;
  error?: string;
  optional?: boolean;
  hint?: string;
  className?: string;
  children: (p: { id: string; className: string; "aria-invalid": boolean; "aria-describedby"?: string }) => React.ReactNode;
}) {
  const errId = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[14px] font-semibold">
        {label}
        {optional && <span className="font-normal text-muted"> (לא חובה)</span>}
        {hint && !optional && <span className="font-normal text-muted"> · {hint}</span>}
      </label>
      {children({ id, className: inputClass, "aria-invalid": !!error, "aria-describedby": error ? errId : undefined })}
      {error && (
        <p id={errId} className="mt-1 text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
