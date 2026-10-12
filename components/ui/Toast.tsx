"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type Tone = "success" | "danger" | "neutral";
interface Toast {
  id: number;
  tone: Tone;
  title: string;
  body?: string;
}
type Push = (t: Omit<Toast, "id">) => void;

const Ctx = createContext<Push>(() => {});
export const useToast = () => useContext(Ctx);

/** Toasts: announced politely, auto-dismiss after 6s, pausable by hovering, always closable. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);
  const push = useCallback<Push>(
    (t) => {
      const id = Date.now() + Math.random();
      setToasts((ts) => [...ts.slice(-2), { ...t, id }]);
      setTimeout(() => dismiss(id), 6000);
    },
    [dismiss],
  );
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6">
        {toasts.map((t) => (
          <div key={t.id} role="status" className="rise-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[16px] bg-raised p-3.5 shadow-3 ring-1 ring-line-soft">
            {t.tone === "success" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden /> : t.tone === "danger" ? <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden /> : <Info className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />}
            <div className="min-w-0 flex-1">
              <p className="text-dense font-semibold text-ink">{t.title}</p>
              {t.body ? <p className="mt-0.5 text-caption text-muted">{t.body}</p> : null}
            </div>
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="-m-1 grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-sunken">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
