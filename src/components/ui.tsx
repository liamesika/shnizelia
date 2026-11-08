"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { formatILS } from "@/lib/money";

/**
 * Bottom sheet on mobile, side drawer on ≥640px. Square edges.
 * Escape / backdrop close, focus kept inside, focus restored on close.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const panel = ref.current;
    (panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel) {
        const items = panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end">
      <div className="fade-enter absolute inset-0 bg-ink/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="sheet-enter relative flex max-h-[92dvh] w-full flex-col border-t-4 border-yolk bg-card shadow-sheet outline-none sm:max-h-none sm:w-[440px] sm:border-t-0 sm:border-r-4"
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
          <div>
            <h2 id={titleId} className="font-display text-[26px] leading-none">
              {title}
            </h2>
            {subtitle && <p className="mt-1.5 text-[14px] text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-m-1 grid size-11 shrink-0 place-items-center text-ink transition-colors hover:bg-sesame"
            aria-label="סגירה"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <div className="px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}

export function QtyStepper({
  value,
  onChange,
  min = 0,
  max = 20,
  label,
  size = "md",
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
  size?: "sm" | "md";
}) {
  const btn = size === "sm" ? "size-9" : "size-12";
  const removing = value === 1 && min === 0;
  return (
    <div className="inline-flex items-stretch border border-ink" role="group" aria-label={label}>
      <button
        type="button"
        className={`${btn} grid place-items-center text-[20px] transition-colors hover:bg-ink hover:text-white disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-ink`}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`הוספת ${label}`}
      >
        +
      </button>
      <span className={`tabular grid place-items-center border-x border-ink font-num ${size === "sm" ? "min-w-9 text-[15px]" : "min-w-12 text-[19px]"}`} aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={`${btn} grid place-items-center text-[20px] transition-colors hover:bg-ink hover:text-white disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-ink`}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={removing ? `הסרת ${label}` : `הפחתת ${label}`}
      >
        {removing ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
          </svg>
        ) : (
          "−"
        )}
      </button>
    </div>
  );
}

export function PrimaryButton({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`flex h-14 w-full items-center justify-center gap-2 bg-zaatar px-5 text-[17px] font-semibold text-white transition-[background-color,transform] hover:bg-zaatar-deep active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#9aa596] ${className}`}
    >
      {children}
    </button>
  );
}

export function SummaryRow({ label, agorot, strong }: { label: string; agorot: number; strong?: boolean }) {
  if (strong) {
    return (
      <div className="flex items-baseline justify-between border-t-2 border-ink pt-3">
        <span className="text-[16px] font-bold">{label}</span>
        <span className="tabular font-num text-[26px] leading-none">{formatILS(agorot)}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between text-[15px] text-muted">
      <span>{label}</span>
      <span className="tabular">{agorot === 0 ? "ללא עלות" : formatILS(agorot)}</span>
    </div>
  );
}

export function BagIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
      <path d="M4.5 8h15l-1.2 13H5.7L4.5 8Z" />
      <path d="M9 10V6a3 3 0 0 1 6 0v4" />
    </svg>
  );
}

export function Spinner() {
  return <span className="inline-block size-4 border-2 border-current border-t-transparent motion-safe:animate-spin" aria-hidden="true" />;
}
