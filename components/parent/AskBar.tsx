"use client";

import { forwardRef, useState } from "react";
import { ArrowUp, Mic, X, Square } from "lucide-react";

/**
 * The glowing ask bar. At rest it is a calm white pill; when focused or
 * listening, the brand's AI gradient draws a ring around it and a soft glow
 * blooms underneath, the one place the gradient lives on the parent screen.
 */
export const AskBar = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (v: string) => void;
    onSubmit: () => void;
    onMic: () => void;
    micSupported: boolean;
    listening: boolean;
    busy: boolean;
    onStop: () => void;
    placeholder: string;
  }
>(function AskBar({ value, onChange, onSubmit, onMic, micSupported, listening, busy, onStop, placeholder }, ref) {
  const [focused, setFocused] = useState(false);
  const glowing = focused || listening || busy;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim() && !busy) onSubmit();
      }}
      className="relative"
      role="search"
      aria-label="Ask the front desk"
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute -inset-x-6 -bottom-8 top-2 rounded-full blur-2xl transition-opacity duration-500 ${glowing ? "glow-breathe opacity-80" : "opacity-0"}`}
        style={{ background: "var(--ai-gradient-linear)" }}
      />
      <div
        className={`relative flex h-14 items-center gap-1 rounded-full bg-surface pl-5 pr-1.5 transition-shadow duration-300 ${glowing ? "ai-ring shadow-ai" : "shadow-2 ring-1 ring-line"} ${focused ? "spin-gradient" : ""}`}
        style={busy ? { animation: "spin-forever 2.4s linear infinite" } : undefined}
      >
        <label htmlFor="ask-input" className="sr-only">
          Your question
        </label>
        <input
          ref={ref}
          id="ask-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={listening ? "Listening…" : placeholder}
          autoComplete="off"
          enterKeyHint="send"
          maxLength={500}
          className="h-full min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-placeholder focus-visible:shadow-none focus-visible:outline-none"
        />
        {value && !busy ? (
          <button
            type="button"
            aria-label="Clear question"
            onClick={() => {
              onChange("");
              (ref as React.RefObject<HTMLInputElement | null>)?.current?.focus();
            }}
            className="pop-in grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-sunken hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
        {micSupported && !value && !busy ? (
          <button
            type="button"
            aria-label={listening ? "Stop listening" : "Ask by voice"}
            aria-pressed={listening}
            onClick={onMic}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition active:scale-95 ${listening ? "bg-danger-tint text-danger-ink" : "text-accent hover:bg-accent-tint"}`}
          >
            <Mic className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
        {busy ? (
          <button type="button" aria-label="Stop answer" onClick={onStop} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-surface transition active:scale-95">
            <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
          </button>
        ) : (
          <button
            type="submit"
            aria-label="Send question"
            disabled={!value.trim()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-on-accent shadow-1 transition hover:bg-accent-hover active:scale-95 disabled:bg-sunken disabled:text-[var(--ink-placeholder)] disabled:shadow-none"
          >
            <ArrowUp className="h-5 w-5" aria-hidden />
          </button>
        )}
      </div>
    </form>
  );
});
