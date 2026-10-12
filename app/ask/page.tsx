import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { person, schoolForSession } from "@/lib/db/queries";
import { AskApp } from "@/components/parent/AskApp";
import { AskSkeleton } from "@/components/parent/AskSkeleton";

export const metadata: Metadata = { title: "Ask the front desk" };

export default function AskPage() {
  return (
    <Suspense fallback={<AskSkeleton />}>
      <AskLoader />
    </Suspense>
  );
}

async function AskLoader() {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role !== "parent") redirect("/operator");
  const [school, me] = await Promise.all([schoolForSession(session), person(session.personId)]);
  return (
    <AskApp
      storageKey={`fd:thread:${session.personId}`}
      school={{ name: school.name, shortName: school.short_name, tagline: school.tagline, phone: school.phone, openNow: school.openNow }}
      parent={{ name: me.name, firstName: me.name.split(" ")[0], hue: me.avatar_hue, child: me.children[0] ?? null }}
    />
  );
}
