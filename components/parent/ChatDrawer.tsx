"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useBackToClose } from "@/components/ui/Sheet";
import {
  AskApp,
  type AskParent,
  type AskSchool,
  type ChatCommand,
  type Turn,
} from "@/components/parent/AskApp";

/**
 * The chat, in a drawer over Home: a sheet from the bottom on phones, a panel
 * from the right on wider screens. It stays mounted once opened, so the
 * conversation is still there next time. Close with the X, "Home", Back or Escape.
 *
 * The panel has a transform, which makes it the containing block for the
 * chat's fixed input bar: the bar sits at the bottom of the drawer, not the page.
 */
export function ChatDrawer({
  open,
  onClose,
  school,
  parent,
  storageKey,
  history,
  command,
}: {
  open: boolean;
  onClose: () => void;
  school: AskSchool;
  parent: AskParent;
  storageKey: string;
  history: Turn[];
  command: ChatCommand | null;
}) {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  const panel = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const drag = useRef<{ y: number; t: number; dy: number } | null>(null);
  useBackToClose(open, onClose);

  // Opening lands on the latest question and answer (unless Home asked for a specific earlier one).
  useEffect(() => {
    if (!open || command?.kind === "show") return;
    const el = scroller.current;
    if (el) requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
  }, [open, command]);

  // Swipe down on the handle or header to close, the way a phone sheet works.
  function onDragStart(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("button, a")) return;
    drag.current = { y: e.clientY, t: performance.now(), dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onDragMove(e: React.PointerEvent) {
    const d = drag.current;
    const el = panel.current;
    if (!d || !el) return;
    d.dy = Math.max(0, e.clientY - d.y);
    el.style.transition = "none";
    el.style.translate = `0 ${d.dy}px`;
  }
  function onDragEnd() {
    const d = drag.current;
    const el = panel.current;
    drag.current = null;
    if (!d || !el) return;
    const fast = d.dy / Math.max(1, performance.now() - d.t) > 0.6;
    el.style.transition = "";
    el.style.translate = "";
    if (d.dy > 120 || (fast && d.dy > 30)) onClose();
  }

  useEffect(() => {
    if (!open) {
      returnTo.current?.focus?.();
      return;
    }
    returnTo.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      // A sheet or listbox inside handles its own Escape.
      if (e.key === "Escape" && !document.querySelector("[data-vaul-drawer]"))
        onClose();
    };
    document.addEventListener("keydown", onKey);
    const lock = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = lock;
    };
  }, [open, onClose]);

  if (!mounted) return null;
  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-[rgba(15,17,32,0.38)] transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={`Chat with ${school.shortName}`}
        inert={!open}
        className={`fixed inset-x-0 bottom-0 top-3 z-40 flex flex-col overflow-hidden [transform:translateZ(0)] rounded-t-[28px] bg-canvas shadow-3 ring-1 ring-line-soft transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] md:inset-y-2 md:left-auto md:right-2 md:top-2 md:w-[min(600px,calc(100vw-16px))] md:rounded-[24px] ${
          open
            ? "translate-x-0 translate-y-0"
            : "translate-y-full md:translate-x-[calc(100%+16px)] md:translate-y-0"
        }`}
      >
        <div
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          className="shrink-0 touch-none md:touch-auto"
        >
          <div
            className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line md:hidden"
            aria-hidden
          />
          <div className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-2 sm:px-6 md:pt-4">
            <nav
              aria-label="Breadcrumb"
              className="min-w-0 flex-1 truncate text-headline font-semibold text-ink"
            >
              <button
                type="button"
                onClick={onClose}
                className="rounded-[6px] text-muted underline decoration-line-strong decoration-1 underline-offset-4 hover:text-ink"
              >
                Home
              </button>
              <span aria-hidden className="mx-1.5 text-muted">
                /
              </span>
              <span aria-current="page">Chat with {school.shortName}</span>
            </nav>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close chat"
              className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
        <div
          ref={scroller}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <AskApp
            school={school}
            parent={parent}
            storageKey={storageKey}
            embedded
            initialTurns={history}
            command={command}
          />
        </div>
      </div>
    </>
  );
}
