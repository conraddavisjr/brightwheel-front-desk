"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Speaking instead of typing, through the browser's own speech recognition
 * (Chrome, Edge, Safari including iPhone). Nothing is recorded or sent by us;
 * the browser turns speech into text. Where recognition is missing,
 * `supported` is false and the mic is hidden. Adapted from Palate.
 */

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function joinTranscript(results: ArrayLike<{ 0: { transcript: string } }>): string {
  return Array.from(results, (r) => r[0].transcript).join("").replace(/\s+/g, " ").trim();
}

export function useSpeechInput(handlers: { onText: (spoken: string) => void; onFinal?: (spoken: string) => void }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const last = useRef("");
  const cbs = useRef(handlers);
  useEffect(() => {
    cbs.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const t = setTimeout(() => setSupported(recognitionCtor() !== null), 0);
    return () => {
      clearTimeout(t);
      rec.current?.abort();
    };
  }, []);

  const stop = useCallback(() => rec.current?.stop(), []);
  const cancel = useCallback(() => {
    last.current = "";
    rec.current?.abort();
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    rec.current?.abort();
    const r = new Ctor();
    r.lang = navigator.language || "en-US";
    r.interimResults = true;
    r.continuous = false;
    last.current = "";
    r.onresult = (e) => {
      last.current = joinTranscript(e.results);
      cbs.current.onText(last.current);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setError("Microphone access is off for this site. Turn it on in your browser settings, or type instead.");
      else if (e.error !== "no-speech" && e.error !== "aborted") setError("Couldn't hear that. Try again, or type it.");
    };
    r.onend = () => {
      setListening(false);
      rec.current = null;
      if (last.current) cbs.current.onFinal?.(last.current);
    };
    rec.current = r;
    setError(null);
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
    }
  }, []);

  return { supported, listening, error, start, stop, cancel };
}
