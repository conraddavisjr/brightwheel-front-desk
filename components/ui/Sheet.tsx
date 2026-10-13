"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Drawer } from "vaul";
import { X } from "lucide-react";

/**
 * One overlay primitive for the whole app, built on Vaul:
 * - phones: a bottom sheet with snap points; drag the handle to resize, flick down to close
 * - wider screens (side="right"): a side drawer you can drag closed, resizable by its edge
 * - Back (button or swipe gesture) closes the overlay instead of leaving the page
 * - focus is trapped inside and returned to the trigger on close (Radix Dialog under Vaul)
 */

/**
 * Push a history entry while open so the browser's Back closes the overlay first.
 * Each overlay tags its entry with its own id, so stacked overlays (a sheet over the
 * chat drawer) close one at a time: an overlay closes only when its own entry is gone.
 */
let nextOverlayId = 1;
const openOverlays = (): number[] => (window.history.state?.__overlays as number[] | undefined) ?? [];

export function useBackToClose(open: boolean, close: () => void) {
  const id = useRef(0);
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  }, [close]);
  useEffect(() => {
    if (!open) {
      // Closed by the app (not by Back): step back over our own entry.
      if (id.current && openOverlays().includes(id.current)) {
        id.current = 0;
        window.history.back();
      }
      return;
    }
    const mine = (id.current = nextOverlayId++);
    window.history.pushState({ ...(window.history.state ?? {}), __overlays: [...openOverlays(), mine] }, "");
    const onPop = () => {
      if (!openOverlays().includes(mine)) {
        id.current = 0;
        closeRef.current();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open]);
}

function useWide(minWidth = 768) {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`);
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [minWidth]);
  return wide;
}

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  side = "auto",
  snapPoints,
  width = 520,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** "auto": bottom sheet on phones, right drawer on md+. */
  side?: "auto" | "bottom" | "right";
  snapPoints?: (number | string)[];
  width?: number;
}) {
  const wide = useWide();
  const right = side === "right" || (side === "auto" && wide);
  useBackToClose(open, () => onOpenChange(false));
  const [panelWidth, setPanelWidth] = useState(width);
  const [snap, setSnap] = useState<number | string | null>(snapPoints?.[0] ?? null);
  // Each time it opens, start at the first snap point (adjusting state during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSnap(snapPoints?.[0] ?? null);
  }

  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = panelWidth;
    const move = (ev: PointerEvent) => setPanelWidth(Math.min(Math.max(startW + (startX - ev.clientX), 380), Math.min(window.innerWidth - 80, 960)));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // Snap points only for read-only sheets: a snapped sheet is translated down, which would hide a footer's action.
  const useSnaps = !right && !footer && snapPoints && snapPoints.length > 1;
  // One snap point is a fixed height: the sheet opens at its full size, and content (or its skeleton) loads inside it.
  const fixedHeight = !right && snapPoints?.length === 1 && typeof snapPoints[0] === "number" ? `${snapPoints[0] * 100}dvh` : undefined;
  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      direction={right ? "right" : "bottom"}
      {...((useSnaps ? { snapPoints, activeSnapPoint: snap, setActiveSnapPoint: setSnap, fadeFromIndex: 0 } : {}) as Record<string, never>)}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40" />
        <Drawer.Content
          aria-describedby={description ? undefined : undefined}
          // Escape inside an open listbox (a custom select) closes the list, not the sheet.
          onEscapeKeyDown={(e) => {
            if ((e.target as HTMLElement | null)?.closest?.('[role="listbox"]')) e.preventDefault();
          }}
          className={
            right
              ? "fixed inset-y-2 right-2 z-50 flex flex-col overflow-hidden rounded-[24px] bg-raised shadow-3 outline-none ring-1 ring-line-soft"
              : "fixed inset-x-0 bottom-0 z-50 flex max-h-[96dvh] flex-col rounded-t-[28px] bg-raised shadow-3 outline-none ring-1 ring-line-soft"
          }
          style={right ? { width: `min(${panelWidth}px, calc(100vw - 16px))` } : { height: useSnaps ? "96dvh" : fixedHeight }}
        >
          {right ? (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize panel"
              tabIndex={0}
              onPointerDown={startResize}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") setPanelWidth((w) => Math.min(w + 32, window.innerWidth - 80));
                if (e.key === "ArrowRight") setPanelWidth((w) => Math.max(w - 32, 380));
              }}
              className="group absolute inset-y-0 left-0 z-10 w-3 cursor-col-resize"
            >
              <span className="absolute inset-y-1/2 left-1 h-10 w-1 -translate-y-1/2 rounded-full bg-line opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100" />
            </div>
          ) : (
            <Drawer.Handle className="!mt-2.5 !mb-1 !h-1.5 !w-10 !bg-line" aria-label="Drag to resize or close" />
          )}
          <div className="flex items-start gap-3 px-5 pt-4 pb-2 sm:px-6">
            <div className="min-w-0 flex-1">
              <Drawer.Title className="text-title-2 font-bold text-ink">{title}</Drawer.Title>
              {description ? <Drawer.Description className="mt-1 text-dense text-muted">{description}</Drawer.Description> : <Drawer.Description className="sr-only">Panel</Drawer.Description>}
            </div>
            <Drawer.Close aria-label="Close" className="-mr-2 -mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted transition hover:bg-sunken hover:text-ink">
              <X className="h-5 w-5" aria-hidden />
            </Drawer.Close>
          </div>
          {/* pt-1: a scroll container clips focus rings; this keeps the first field's ring whole. */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-1 pb-6 sm:px-6">
            {children}
          </div>
          {footer ? <div className="border-t border-line-soft bg-raised px-5 py-3 sm:px-6" style={{ paddingBottom: "max(12px, var(--safe-bottom))" }}>{footer}</div> : null}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
