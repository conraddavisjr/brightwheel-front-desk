import { z } from "zod";
import { requireStaff } from "@/lib/operator/auth";
import { ingestDocument } from "@/lib/ingest/ingest";
import { audit, manualSource } from "@/lib/operator/manualSource";

const Body = z.object({ title: z.string().trim().min(1).max(160), content: z.string().max(200_000).default(""), visibility: z.enum(["family", "staff"]).default("family") });

/** A new page written in Front Desk. */
export async function POST(req: Request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Give the page a title." }, { status: 400 });
  const { session } = auth;
  const sourceId = await manualSource(session.schoolId);
  const r = await ingestDocument({
    schoolId: session.schoolId,
    sourceId,
    externalId: `page:${crypto.randomUUID()}`,
    title: parsed.data.title,
    content: parsed.data.content || `# ${parsed.data.title}\n\n`,
    emoji: "📝",
    parentTitle: "Front Desk answers",
    authoredBy: session.personId,
    visibility: parsed.data.visibility,
  });
  await audit(session.schoolId, session.personId, "document.create", { documentId: r.documentId, title: parsed.data.title });
  return Response.json({ ok: true, documentId: r.documentId, held: r.newlyHeld });
}
