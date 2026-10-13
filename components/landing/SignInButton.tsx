"use client";

import { useState, useTransition, type ReactNode } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { signInAs } from "@/lib/demo/actions";
import type { DemoRole, DemoSchool } from "@/lib/demo/signIn";

/** One-tap demo sign-in. The Server Action sets the session and redirects in one round trip. */
export function SignInButton({
  school,
  role,
  children,
  variant = "primary",
}: {
  school: DemoSchool;
  role: DemoRole;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go() {
    setError(null);
    startTransition(async () => {
      const result = await signInAs(school, role).catch(() => ({ error: "Could not sign in. Check your connection and try again." }));
      if (result?.error) setError(result.error);
    });
  }

  const base =
    "group inline-flex min-h-12 w-full items-center justify-between gap-3 rounded-full px-5 text-left text-[15px] font-semibold transition-[background,transform,box-shadow] duration-150 active:scale-[0.98] disabled:opacity-70";
  const look =
    variant === "primary"
      ? "bg-accent text-on-accent shadow-2 hover:bg-accent-hover"
      : "bg-surface text-ink ring-1 ring-line hover:ring-line-strong hover:bg-accent-tint-2";
  return (
    <div>
      <button type="button" onClick={go} disabled={pending} className={`${base} ${look}`}>
        <span>{children}</span>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-label text-danger-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
