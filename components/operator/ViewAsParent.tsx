"use client";

import { useTransition, type ReactNode } from "react";
import { signInAs } from "@/lib/demo/actions";
import type { DemoSchool } from "@/lib/demo/signIn";

/** Jump into the parent experience for the same school (to test an answer you just published). */
export function ViewAsParent({ school, children, compact = false }: { school: DemoSchool; children: ReactNode; compact?: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => void (await signInAs(school, "parent")))}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition disabled:opacity-70 ${compact ? "h-9 px-3 text-caption bg-accent-tint text-accent" : "h-9 bg-accent text-caption text-on-accent hover:bg-accent-hover"}`}
    >
      {children}
    </button>
  );
}
