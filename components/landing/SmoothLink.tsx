"use client";

import type { ReactNode } from "react";

/** An in-page link that glides to its section (instantly under reduced motion) and keeps the #hash in the URL. */
export function SmoothLink({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  return (
    <a
      href={`#${to}`}
      className={className}
      onClick={(e) => {
        const target = document.getElementById(to);
        if (!target) return;
        e.preventDefault();
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        window.history.replaceState(window.history.state, "", `#${to}`);
      }}
    >
      {children}
    </a>
  );
}
