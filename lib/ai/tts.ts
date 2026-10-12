import "server-only";
import { generateSpeech } from "ai";
import { config } from "@/lib/config";
import { canCallModel, gemini, meter } from "@/lib/ai/provider";

/**
 * Gemini text to speech for spoken answers. Returns null when unavailable
 * (no key, daily cap, error) so the browser falls back to its own voice.
 * Gemini returns raw PCM in some versions; we wrap it as WAV so every
 * browser can play it.
 */
export async function synthesize(text: string): Promise<{ bytes: Uint8Array<ArrayBuffer>; mime: string } | null> {
  if (!(await canCallModel())) return null;
  try {
    const result = await generateSpeech({
      model: gemini().speech(config.ai.ttsModel),
      text,
      voice: config.ai.ttsVoice,
      instructions: "Warm, calm and friendly, like a kind preschool front desk. Natural pace.",
    });
    await meter("tts", text.length, 0);
    const mime = result.audio.mediaType ?? "audio/wav";
    const raw = result.audio.uint8Array;
    if (/l16|pcm/i.test(mime)) return { bytes: wav(raw, 24000), mime: "audio/wav" };
    return { bytes: new Uint8Array(raw), mime };
  } catch (err) {
    console.error("[tts] failed, device voice will be used", err);
    return null;
  }
}

function wav(pcm: Uint8Array, sampleRate: number): Uint8Array<ArrayBuffer> {
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + pcm.length, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, pcm.length, true);
  const out = new Uint8Array(new ArrayBuffer(44 + pcm.length));
  out.set(new Uint8Array(header), 0);
  out.set(pcm, 44);
  return out;
}
