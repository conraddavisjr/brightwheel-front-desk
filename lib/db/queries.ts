import "server-only";
import { db, must } from "@/lib/db/client";
import type { Session } from "@/lib/session";
import { openNow, type WeeklyHours } from "@/lib/answer/hours";

export async function schoolForSession(session: Session) {
  const s = must(await db().from("schools").select("id,slug,name,short_name,tagline,phone,email,address,timezone,hours,city,ages").eq("id", session.schoolId).single(), "school");
  return { ...s, openNow: openNow((s.hours ?? {}) as WeeklyHours, s.timezone) };
}

export async function person(id: string) {
  return must(await db().from("people").select("id,name,role,avatar_hue,children,email").eq("id", id).single(), "person") as {
    id: string;
    name: string;
    role: string;
    avatar_hue: number;
    children: Array<{ name: string; room: string }>;
    email: string | null;
  };
}
