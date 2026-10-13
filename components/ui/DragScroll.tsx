"use client";

import { useRef, type ReactNode } from "react";

/**
 * A row that scrolls sideways: swipe on touch, drag with a mouse, or scroll with a trackpad.
 * Keyboard users tab through the items inside it as usual.
 */
export function DragScroll({ children, className = "", label }: { children: ReactNode; className?: string; label: string }) {
  const el = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  return (
    <div
      ref={el}
      role="region"
      aria-label={label}
      tabIndex={0}
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse" || !el.current) return; // touch already swipes natively
        drag.current = { x: e.clientX, left: el.current.scrollLeft, moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || !el.current) return;
        const dx = e.clientX - d.x;
        if (Math.abs(dx) > 3) d.moved = true;
        el.current.scrollLeft = d.left - dx;
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerLeave={() => (drag.current = null)}
      className={`scrollbar-none cursor-grab overflow-x-auto overscroll-x-contain active:cursor-grabbing ${className}`}
    >
      {children}
    </div>
  );
}
