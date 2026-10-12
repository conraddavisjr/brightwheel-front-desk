import type { AskEvent } from "@/lib/schemas";

/** Read POST /api/ask's newline-delimited JSON events. */
export async function* readAsk(res: Response, signal?: AbortSignal): AsyncGenerator<AskEvent> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      if (signal?.aborted) break;
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (line) yield JSON.parse(line) as AskEvent;
      }
    }
    if (buf.trim()) yield JSON.parse(buf) as AskEvent;
  } finally {
    reader.releaseLock();
  }
}
