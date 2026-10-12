import { z } from "zod";
import { getSession } from "@/lib/session";
import { synthesize } from "@/lib/ai/tts";
import { hit } from "@/lib/guard/rateLimit";
import { clientIp } from "@/lib/http";

const Body = z.object({ text: z.string().trim().min(1).max(600) });

/** Gemini TTS for a spoken answer. 204 tells the client to use the device voice instead. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return new Response(null, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });
  const rl = await hit(`tts:${session.personId}:${clientIp(req)}`, 40, 600);
  if (!rl.ok) return new Response(null, { status: 204 });
  const audio = await synthesize(parsed.data.text);
  if (!audio) return new Response(null, { status: 204 });
  return new Response(audio.bytes, { headers: { "content-type": audio.mime, "cache-control": "no-store" } });
}
