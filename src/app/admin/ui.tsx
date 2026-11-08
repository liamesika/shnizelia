import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "./actions";
import type { Order } from "@/lib/types";

export function AdminShell({ children, active }: { children: ReactNode; active: "orders" | "settings" }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link
      href={href}
      className={`rounded-full px-3.5 py-1.5 text-[14px] ${on ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
      aria-current={on ? "page" : undefined}
    >
      {label}
    </Link>
  );
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      <header className="flex h-16 items-center justify-between gap-3">
        <nav className="flex items-center gap-1">
          {tab("/admin", "הזמנות", active === "orders")}
          {tab("/admin/settings", "הגדרות", active === "settings")}
        </nav>
        <form action={logout}>
          <button className="text-[14px] text-muted hover:text-ink">יציאה</button>
        </form>
      </header>
      {children}
    </div>
  );
}

export function Panel({ title, children, aside }: { title?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-card p-4 sm:p-5">
      {(title || aside) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-[16px] font-bold">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export const inputCls =
  "h-11 w-full rounded-lg border border-line bg-card px-3 text-[15px] focus:border-ink focus:outline-none";

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-[13px] font-medium text-muted">
      {children}
    </label>
  );
}

export function StatusBadge({ label, tone }: { label: string; tone: "ok" | "warn" | "muted" | "bad" }) {
  const cls = {
    ok: "bg-[#EEF3EC] text-[#3F6B3A]",
    warn: "bg-[#F7EDE4] text-accent",
    muted: "bg-sand text-muted",
    bad: "bg-[#F6E7E3] text-danger",
  }[tone];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[12px] font-medium whitespace-nowrap ${cls}`}>{label}</span>;
}

export function statusTone(o: Order): "ok" | "warn" | "muted" | "bad" {
  if (o.status === "cancel_requested") return "warn";
  if (o.status === "cancelled" || o.status === "payment_failed") return "bad";
  if (o.status === "pending_payment") return "muted";
  return "ok";
}

