import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireStaff } from "@/lib/operator/auth";
import { audit } from "@/lib/operator/manualSource";

const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 07:30.");
const Day = z
  .tuple([Time, Time])
  .nullable()
  .refine((d) => !d || d[0] < d[1], "Opening time must be before closing time.");
const Body = z.object({ hours: z.object({ mon: Day, tue: Day, wed: Day, thu: Day, fri: Day, sat: Day, sun: Day }) });

/** Opening hours are structured data the director owns; every hours answer reads from them. */
export async function PATCH(req: Request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Check the hours." }, { status: 400 });
  const { session } = auth;
  const { error } = await db().from("schools").update({ hours: parsed.data.hours }).eq("id", session.schoolId);
  if (error) return Response.json({ error: "Couldn't save the hours." }, { status: 500 });
  await audit(session.schoolId, session.personId, "school.hours.update", { hours: parsed.data.hours });
  return Response.json({ ok: true });
}
