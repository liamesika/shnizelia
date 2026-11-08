"use client";

import { useActionState } from "react";
import { login } from "../actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <main className="mx-auto flex min-h-dvh max-w-xs flex-col justify-center px-5">
      <h1 className="mb-6 text-[24px] font-extrabold">ניהול</h1>
      <form action={action} className="space-y-3">
        <label htmlFor="password" className="block text-[14px] font-medium">
          סיסמה
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-12 w-full rounded-xl border border-line bg-card px-3.5 text-[16px] focus:border-ink focus:outline-none"
        />
        {state && !state.ok && (
          <p role="alert" className="text-[14px] text-danger">
            {state.message}
          </p>
        )}
        <button disabled={pending} className="h-12 w-full rounded-xl bg-ink text-white disabled:opacity-50">
          {pending ? "נכנסים…" : "כניסה"}
        </button>
      </form>
    </main>
  );
}
