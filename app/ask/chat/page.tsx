import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { person, schoolForSession } from "@/lib/db/queries";
import { AskApp } from "@/components/parent/AskApp";
import { AskSkeleton } from "@/components/parent/AskSkeleton";

export const metadata: Metadata = { title: "Chat with the front desk" };

export default function ChatPage({ searchParams }: PageProps<"/ask/chat">) {
  return (
    <Suspense fallback={<AskSkeleton />}>
      <ChatLoader searchParams={searchParams} />
    </Suspense>
  );
}

async function ChatLoader({ searchParams }: { searchParams: PageProps<"/ask/chat">["searchParams"] }) {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role !== "parent") redirect("/operator");
  const [school, me, params] = await Promise.all([schoolForSession(session), person(session.personId), searchParams]);
  const q = typeof params.q === "string" ? params.q.slice(0, 500) : null;
  return (
    <AskApp
      storageKey={`fd:thread:${session.personId}`}
      school={{ slug: school.slug, name: school.name, shortName: school.short_name, tagline: school.tagline, phone: school.phone, openNow: school.openNow }}
      parent={{ name: me.name, firstName: me.name.split(" ")[0], hue: me.avatar_hue, child: me.children[0] ?? null }}
      initialQuestion={q}
      openSickCheck={params.check === "sick"}
    />
  );
}
