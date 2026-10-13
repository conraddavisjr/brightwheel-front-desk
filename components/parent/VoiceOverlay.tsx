"use client";

import { X } from "lucide-react";

/**
 * Voice mode: the screen dims, a living gradient rises from the bottom edge
 * (the Gemini idea, in brightwheel's colors) and the words appear as they
 * are heard. Tap anywhere or the X to stop.
 */
export function VoiceOverlay({ phase, transcript, onClose }: { phase: "listening" | "thinking" | "speaking"; transcript: string; onClose: () => void }) {
  const label = phase === "listening" ? "Listening" : phase === "thinking" ? "Checking" : "Speaking";
  return (
    <div role="dialog" aria-modal="true" aria-label="Voice mode" className="fade-in fixed inset-0 z-50 flex flex-col overflow-hidden bg-[color-mix(in_oklab,var(--canvas)_88%,transparent)] backdrop-blur-md">
      <div className="flex justify-end p-4">
        <button type="button" onClick={onClose} aria-label="Close voice mode" className="grid h-11 w-11 place-items-center rounded-full bg-surface text-ink shadow-2">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <p className="text-label font-semibold uppercase tracking-[0.14em] text-ai-ink" aria-live="polite">
          {label}
        </p>
        <p className="mt-4 max-w-md text-balance text-[26px] font-semibold leading-tight text-ink" aria-live="polite">
          {transcript || (phase === "listening" ? "Ask anything about your school…" : "")}
        </p>
      </div>
      {/* The glow fades into the page: a mask feathers its top, so there is no edge to see. */}
      <div aria-hidden className="relative h-72" style={{ maskImage: "linear-gradient(to top, black 35%, transparent)", WebkitMaskImage: "linear-gradient(to top, black 35%, transparent)" }}>
        <div className={`absolute inset-x-[-20%] bottom-[-60%] h-[160%] rounded-[50%] blur-3xl ${phase === "listening" ? "glow-breathe" : ""}`} style={{ background: "var(--ai-gradient-linear)", opacity: phase === "thinking" ? 0.55 : 0.85 }} />
        <div className="absolute inset-x-0 bottom-10 flex items-end justify-center gap-1.5">
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              className="w-2 rounded-full bg-white/90"
              style={{
                height: phase === "thinking" ? 8 : 14 + ((i * 7) % 18),
                animation: phase === "thinking" ? "none" : `glow-breathe ${0.8 + i * 0.13}s ease-in-out infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
