"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";

/** A direct line to a human. The message lands in the director's Conversations view. */
export function MessageStaffSheet({ open, about, conversationId, schoolName, onClose }: { open: boolean; about: string | null; conversationId: string | null; schoolName: string; onClose: () => void }) {
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setText(about ? `About my question "${about}": ` : "");
      setState("idle");
    }
  }

  async function send() {
    if (!text.trim()) return;
    setState("sending");
    const res = await fetch("/api/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, conversationId }) }).catch(() => null);
    setState(res?.ok ? "sent" : "error");
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={state === "sent" ? "Sent to the front desk" : `Message ${schoolName}`}
      description={state === "sent" ? undefined : "Goes to the staff, not the assistant. They usually reply within the hour."}
      footer={
        state === "sent" ? (
          <button type="button" onClick={onClose} className="h-12 w-full rounded-full bg-accent text-[15px] font-semibold text-on-accent">
            Done
          </button>
        ) : (
          <button type="button" onClick={send} disabled={!text.trim() || state === "sending"} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-semibold text-on-accent disabled:opacity-60">
            {state === "sending" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            Send message
          </button>
        )
      }
    >
      {state === "sent" ? (
        <div className="flex flex-col items-center py-8 text-center">
          <CheckCircle2 className="pop-in h-14 w-14 text-success" aria-hidden />
          <p className="mt-4 max-w-xs text-body text-muted">You&apos;ll get a reply in the brightwheel app. For anything urgent, call the school.</p>
        </div>
      ) : (
        <>
          <label htmlFor="staff-msg" className="sr-only">
            Your message
          </label>
          <textarea
            id="staff-msg"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            maxLength={1500}
            autoFocus
            className="w-full resize-none rounded-[16px] bg-surface p-4 text-body text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-accent"
          />
          {state === "error" ? (
            <p role="alert" className="mt-2 text-label text-danger-ink">
              That didn&apos;t send. Check your connection and try again.
            </p>
          ) : null}
        </>
      )}
    </Sheet>
  );
}
