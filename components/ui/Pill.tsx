import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info" | "ai" | "teal" | "pink" | "orange";

const TONES: Record<Tone, { bg: string; ink: string; dot: string }> = {
  neutral: { bg: "bg-sunken", ink: "text-muted", dot: "bg-[var(--ink-placeholder)]" },
  accent: { bg: "bg-accent-tint", ink: "text-accent", dot: "bg-accent" },
  success: { bg: "bg-success-tint", ink: "text-success-ink", dot: "bg-success" },
  warning: { bg: "bg-warning-tint", ink: "text-warning-ink", dot: "bg-warning" },
  danger: { bg: "bg-danger-tint", ink: "text-danger-ink", dot: "bg-danger" },
  info: { bg: "bg-info-tint", ink: "text-info-ink", dot: "bg-info" },
  ai: { bg: "bg-ai-tint", ink: "text-ai-ink", dot: "bg-ai-ink" },
  teal: { bg: "bg-teal-tint", ink: "text-teal-ink", dot: "bg-teal" },
  pink: { bg: "bg-pink-tint", ink: "text-pink-ink", dot: "bg-pink" },
  orange: { bg: "bg-orange-tint", ink: "text-orange-ink", dot: "bg-orange" },
};

/** Status pill: a dot plus a word, never color alone. */
export function Pill({ tone = "neutral", dot = true, pulse = false, children, className = "" }: { tone?: Tone; dot?: boolean; pulse?: boolean; children: ReactNode; className?: string }) {
  const t = TONES[tone];
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-label font-semibold ${t.bg} ${t.ink} ${className}`}>
      {dot ? <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.dot} ${pulse ? "pulse-dot" : ""}`} style={pulse ? { color: "var(--success)" } : undefined} /> : null}
      {children}
    </span>
  );
}

export type { Tone };
