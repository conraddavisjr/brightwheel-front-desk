import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { peopleById, recentMessages } from "@/lib/db/operator";
import { PageHeader } from "@/components/operator/Panel";
import { ConversationsView, type Thread } from "@/components/operator/ConversationsView";
import { ListSkeleton } from "@/components/operator/ListSkeleton";

export const metadata: Metadata = { title: "Conversations" };

export default function ConversationsPage() {
  return (
    <main className="mx-auto max-w-[1000px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader title="Conversations" subtitle="What families asked, what Front Desk said, and how they rated it. Step in with a personal reply any time." />
      <Suspense fallback={<ListSkeleton rows={8} />}>
        <Data />
      </Suspense>
    </main>
  );
}

async function Data() {
  const s = await getSession();
  if (!s || s.role === "parent") redirect("/");
  const [msgs, people] = await Promise.all([recentMessages(s.schoolId, 30), peopleById(s.schoolId)]);
  const byConv = new Map<string, typeof msgs>();
  for (const m of msgs) byConv.set(m.conversation_id, [...(byConv.get(m.conversation_id) ?? []), m]);
  const threads: Thread[] = [];
  for (const [id, list] of byConv) {
    const parentMsg = list.find((m) => m.role === "parent" && m.author_id);
    const parent = parentMsg?.author_id ? people.get(parentMsg.author_id) : undefined;
    const lastParent = [...list].reverse().find((m) => m.role === "parent");
    const answers = list.filter((m) => m.role === "assistant");
    const lastStaffIdx = list.map((m) => m.role).lastIndexOf("staff");
    const needsReply = list.some((m, i) => m.reason === "to_staff" && i > lastStaffIdx);
    threads.push({
      id,
      parent: parent ? { id: parent.id, name: parent.name, hue: parent.avatar_hue, child: parent.children[0] ?? null } : null,
      lastQuestion: lastParent?.text ?? "",
      lastAt: list[list.length - 1].created_at,
      outcome: answers[answers.length - 1]?.outcome ?? null,
      feedback: answers.some((a) => a.feedback === -1) ? -1 : answers.some((a) => a.feedback === 1) ? 1 : null,
      needsReply,
      messages: list.map((m) => ({ id: m.id, role: m.role, text: m.text, outcome: m.outcome, feedback: m.feedback, citations: m.citations?.map((c) => c.title) ?? [], at: m.created_at, toStaff: m.reason === "to_staff" })),
    });
  }
  threads.sort((a, b) => Number(b.needsReply) - Number(a.needsReply) || b.lastAt.localeCompare(a.lastAt));
  return <ConversationsView threads={threads.slice(0, 300)} />;
}
