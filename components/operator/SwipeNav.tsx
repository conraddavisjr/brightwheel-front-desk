"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Tab bar order: swipe left for the next section, right for the previous one. */
const ORDER = ["/operator", "/operator/inbox", "/operator/conversations", "/operator/knowledge", "/operator/privacy", "/operator/sources"];
const EDGE = 32;

function scrollsSideways(el: Element | null): boolean {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    const style = getComputedStyle(n);
    if ((style.overflowX === "auto" || style.overflowX === "scroll") && n.scrollWidth > n.clientWidth) return true;
  }
  return false;
}

/**
 * Swipe between operator sections on phones and tablets. Swipes that start near a screen edge are
 * left to the browser (its own back/forward gesture), as are swipes inside anything that scrolls
 * sideways, form fields and open drawers.
 */
export function SwipeNav() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    let start: { x: number; y: number; t: number } | null = null;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      const target = e.target as Element | null;
      start = null;
      if (e.touches.length !== 1 || t.clientX < EDGE || t.clientX > window.innerWidth - EDGE) return;
      if (target?.closest("input, textarea, select, [contenteditable], [role='dialog'], [data-vaul-drawer]") || scrollsSideways(target)) return;
      start = { x: t.clientX, y: t.clientY, t: performance.now() };
    };
    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const quick = performance.now() - start.t < 600;
      start = null;
      if (!quick || Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 2) return;
      const i = ORDER.indexOf(pathname);
      if (i === -1) return;
      const next = ORDER[i + (dx < 0 ? 1 : -1)];
      if (next) router.push(next);
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
    };
  }, [pathname, router]);
  return null;
}
