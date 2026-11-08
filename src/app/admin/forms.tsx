"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "./actions";

/** Wraps a server action form with pending + result message. */
export function ActionForm({
  action,
  children,
  submitLabel = "שמירה",
  className = "",
  confirm,
}: {
  action: (prev: ActionState, f: FormData) => Promise<ActionState>;
  children: ReactNode;
  submitLabel?: string;
  className?: string;
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-xl bg-ink px-5 text-[15px] font-medium text-white disabled:opacity-50"
        >
          {pending ? "שומר…" : submitLabel}
        </button>
        {state && (
          <span role="status" className={`text-[14px] ${state.ok ? "text-muted" : "text-danger"}`}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}

export function SubmitOnChange({ children }: { children: ReactNode }) {
  return (
    <div
      onChange={(e) => {
        const form = (e.target as HTMLElement).closest("form");
        form?.requestSubmit();
      }}
    >
      {children}
    </div>
  );
}
