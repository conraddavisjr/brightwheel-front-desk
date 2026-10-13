import "server-only";
import { db } from "@/lib/db/client";
import { zonedMidnight } from "@/lib/time";

/**
 * A closure on the school calendar for a day (0 = today, 1 = tomorrow), like "Veterans Day".
 * An all-day event ends at the next midnight, so the end bound is strict: a closure that ends
 * at midnight does not also close the following day.
 */
export async function closureOn(schoolId: string, tz: string, offset: number): Promise<string | null> {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + offset * 86400000));
  const start = zonedMidnight(day, tz);
  const end = new Date(start.getTime() + 86400000);
  const { data } = await db()
    .from("events")
    .select("title")
    .eq("school_id", schoolId)
    .eq("visibility", "family")
    .lt("starts_at", end.toISOString())
    .gt("ends_at", start.toISOString())
    .limit(10);
  const hit = (data ?? []).find((e) => /\b(closed|closure|no school)\b/i.test(e.title));
  return hit ? hit.title.replace(/^\s*(closed|closure)\s*[-:·]\s*/i, "").trim() || "a school closure" : null;
}
