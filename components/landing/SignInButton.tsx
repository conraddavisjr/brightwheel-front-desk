"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

/** One-tap demo sign-in. Prefetches the destination so the switch feels instant. */
export function SignInButton({
  school,
  role,
  children,
  variant = "primary",
}: {
  school: "sunflower-valley" | "harbor-kids";
  role: "director" | "parent";
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dest = role === "director" ? "/operator" : "/ask";

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/demo/signin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ school, role }) });
      const json = (await res.json()) as { redirect?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not sign in.");
      router.push(json.redirect ?? dest);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in.");
      setBusy(false);
    }
  }

  const base =
    "group inline-flex min-h-12 w-full items-center justify-between gap-3 rounded-full px-5 text-left text-[15px] font-semibold transition-[background,transform,box-shadow] duration-150 active:scale-[0.98] disabled:opacity-70";
  const look =
    variant === "primary"
      ? "bg-accent text-on-accent shadow-2 hover:bg-accent-hover"
      : "bg-surface text-ink ring-1 ring-line hover:ring-line-strong hover:bg-accent-tint-2";
  return (
    <div>
      <button type="button" onClick={go} onMouseEnter={() => router.prefetch(dest)} disabled={busy} className={`${base} ${look}`}>
        <span>{children}</span>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-label text-danger-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
