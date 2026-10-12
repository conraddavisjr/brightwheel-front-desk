"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/** Jump into the parent experience for the same school (to test an answer you just published). */
export function ViewAsParent({ school, children, compact = false }: { school: "sunflower-valley" | "harbor-kids"; children: ReactNode; compact?: boolean }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/demo/signin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ school, role: "parent" }) });
        router.push("/ask");
      }}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition ${compact ? "h-9 px-3 text-caption bg-accent-tint text-accent" : "h-9 bg-accent text-caption text-on-accent hover:bg-accent-hover"}`}
    >
      {children}
    </button>
  );
}
