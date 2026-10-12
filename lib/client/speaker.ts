"use client";

/**
 * Speaking answers aloud. Gemini TTS through /api/voice/speak when the
 * server has a key (a warm, natural voice), the device's own voice when it
 * does not or when the request fails. Fillers are pre-rendered static audio
 * (public/voice/*.mp3 when present) so "One moment" plays instantly for free.
 */

let current: HTMLAudioElement | null = null;
let serverVoice: boolean | null = null;

export function stopSpeaking() {
  current?.pause();
  current = null;
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}

function deviceSpeak(text: string): Promise<void> {
  return new Promise((resolve) => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return resolve();
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

export async function speak(text: string): Promise<void> {
  stopSpeaking();
  if (!text.trim()) return;
  if (serverVoice !== false) {
    try {
      const res = await fetch("/api/voice/speak", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
      if (res.status === 204 || !res.ok) {
        serverVoice = res.status === 204 ? false : serverVoice;
        return deviceSpeak(text);
      }
      serverVoice = true;
      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      current = audio;
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      });
      URL.revokeObjectURL(url);
      return;
    } catch {
      return deviceSpeak(text);
    }
  }
  return deviceSpeak(text);
}
