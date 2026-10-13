"use client";

/**
 * Speaking answers aloud. Gemini TTS through /api/voice/speak when the
 * server has a key (a warm, natural voice), the device's own voice when it
 * does not or when the request fails. Fillers are pre-rendered static audio
 * (public/voice/*.mp3 when present) so "One moment" plays instantly for free.
 */

let current: HTMLAudioElement | null = null;
let serverVoice: boolean | null = null;
// Lines play one after another ("Great question, one moment." then the answer), never over each other.
// Stopping bumps the generation, so anything queued or still downloading is dropped.
let generation = 0;
let queue: Promise<void> = Promise.resolve();

export function stopSpeaking() {
  generation++;
  queue = Promise.resolve();
  current?.pause();
  current = null;
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}

function deviceSpeak(text: string, gen: number): Promise<void> {
  return new Promise((resolve) => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth || gen !== generation) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    const preferred = voices.find((v) => /Samantha|Google US English|Ava|Allison|Serena/i.test(v.name) && v.lang.startsWith("en")) ?? voices.find((v) => v.lang.startsWith(navigator.language.slice(0, 2)));
    if (preferred) u.voice = preferred;
    u.rate = 1.03;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.speak(u);
  });
}

/** Fetch the natural voice for a line; null means use the device voice. */
async function render(text: string): Promise<Blob | null> {
  if (serverVoice === false) return null;
  try {
    const res = await fetch("/api/voice/speak", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
    if (res.status === 204) serverVoice = false;
    if (!res.ok || res.status === 204) return null;
    serverVoice = true;
    return await res.blob();
  } catch {
    return null;
  }
}

async function play(text: string, audio: Promise<Blob | null>, gen: number): Promise<void> {
  const blob = await audio;
  if (gen !== generation) return;
  if (!blob) return deviceSpeak(text, gen);
  const url = URL.createObjectURL(blob);
  const el = new Audio(url);
  current = el;
  await new Promise<void>((resolve) => {
    el.onended = () => resolve();
    el.onerror = () => resolve();
    el.play().catch(() => resolve());
  });
  URL.revokeObjectURL(url);
}

/**
 * Queue a line after whatever is speaking. Its audio starts downloading now,
 * so the answer is ready the moment the filler ends. Resolves when it has been spoken.
 */
export function say(text: string): Promise<void> {
  if (!text.trim()) return queue;
  const gen = generation;
  const audio = render(text);
  queue = queue.then(() => (gen === generation ? play(text, audio, gen) : undefined));
  return queue;
}

/** Interrupt anything speaking and say this instead. */
export function speak(text: string): Promise<void> {
  stopSpeaking();
  return say(text);
}
