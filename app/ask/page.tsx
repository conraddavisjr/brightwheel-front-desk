import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { person, schoolForSession } from "@/lib/db/queries";
import { parentHome } from "@/lib/db/parent";
import { ago } from "@/lib/time";
import { ParentHeader } from "@/components/parent/ParentHeader";
import { ParentHome } from "@/components/parent/ParentHome";
import { HomeSkeleton } from "@/components/parent/AskSkeleton";

export const metadata: Metadata = { title: "Home" };

export default function ParentHomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeLoader />
    </Suspense>
  );
}

async function HomeLoader() {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role !== "parent") redirect("/operator");
  const [school, me, data] = await Promise.all([schoolForSession(session), person(session.personId), parentHome(session.schoolId, session.personId)]);
  const withWhen = <T extends { at: string }>(xs: T[]) => xs.map((x) => ({ ...x, when: ago(x.at) }));
  return (
    <div className="mx-auto flex min-h-dvh max-w-[720px] flex-col">
      <ParentHeader school={{ slug: school.slug, name: school.name, shortName: school.short_name, openNow: school.openNow }} />
      <ParentHome
        personId={session.personId}
        school={{ slug: school.slug, name: school.name, shortName: school.short_name, tagline: school.tagline, phone: school.phone, openNow: school.openNow }}
        parent={{ name: me.name, firstName: me.name.split(" ")[0], hue: me.avatar_hue, child: me.children[0] ?? null }}
        data={{ replies: withWhen(data.replies), pending: withWhen(data.pending), recent: withWhen(data.recent) }}
        history={data.thread.map((t) => ({ id: t.id, question: t.question, ack: null, status: null, card: t.card, streaming: false, messageId: t.messageId, feedback: t.feedback, error: null, at: t.at }))}
      />
    </div>
  );
}
