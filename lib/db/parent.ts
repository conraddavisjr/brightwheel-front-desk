import "server-only";
import { db, must } from "@/lib/db/client";

export interface StaffReply {
  id: string;
  kind: "answer" | "message";
  /** What the parent asked or wrote. */
  about: string;
  text: string;
  at: string;
  by: { name: string; hue: number } | null;
}
export interface Pending {
  id: string;
  kind: "question" | "message";
  text: string;
  at: string;
}
export interface ThreadTurn {
  id: string;
  question: string;
  card: Record<string, unknown>;
  messageId: string | null;
  feedback: 1 | -1 | null;
}
export interface RecentQuestion {
  id: string;
  question: string;
  answer: string;
  outcome: string;
  at: string;
}

/**
 * Everything on a parent's home screen, scoped to that one parent: replies
 * from staff, what is still waiting on staff, and their recent questions.
 */
export async function parentHome(schoolId: string, parentId: string): Promise<{ replies: StaffReply[]; pending: Pending[]; recent: RecentQuestion[]; thread: ThreadTurn[] }> {
  const client = db();
  const [convs, gaps] = await Promise.all([
    client.from("conversations").select("id").eq("school_id", schoolId).eq("parent_id", parentId).order("last_at", { ascending: false }).limit(60),
    client.from("gaps").select("id,question,status,answer,answered_by,answered_at,first_asked_at,last_asked_at").eq("school_id", schoolId).eq("kind", "question").contains("asker_ids", [parentId]),
  ]);
  const convIds = (must(convs, "conversations") as Array<{ id: string }>).map((c) => c.id);
  const msgs = convIds.length
    ? (must(
        await client.from("messages").select("id,conversation_id,role,text,outcome,reason,author_id,created_at,card,feedback").in("conversation_id", convIds).order("created_at", { ascending: true }),
        "messages",
      ) as Array<{ id: string; conversation_id: string; role: string; text: string; outcome: string | null; reason: string | null; author_id: string | null; created_at: string; card: ({ headline?: string } & Record<string, unknown>) | null; feedback: 1 | -1 | null }>)
    : [];
  const gapRows = must(gaps, "gaps") as Array<{ id: string; question: string; status: string; answer: string | null; answered_by: string | null; answered_at: string | null; first_asked_at: string; last_asked_at: string }>;

  const staffIds = [...new Set([...gapRows.map((g) => g.answered_by), ...msgs.filter((m) => m.role === "staff").map((m) => m.author_id)].filter((x): x is string => Boolean(x)))];
  const staff = staffIds.length ? (must(await client.from("people").select("id,name,avatar_hue").in("id", staffIds), "people") as Array<{ id: string; name: string; avatar_hue: number }>) : [];
  const who = (id: string | null) => {
    const p = staff.find((s) => s.id === id);
    return p ? { name: p.name, hue: p.avatar_hue } : null;
  };

  const replies: StaffReply[] = [];
  const pending: Pending[] = [];
  for (const g of gapRows) {
    if (g.status === "answered" && g.answer && g.answered_at) replies.push({ id: `gap:${g.id}`, kind: "answer", about: g.question, text: g.answer, at: g.answered_at, by: who(g.answered_by) });
    else if (g.status === "open") pending.push({ id: `gap:${g.id}`, kind: "question", text: g.question, at: g.last_asked_at });
  }

  // Messages to staff: answered when a staff reply follows in the same conversation.
  const byConv = new Map<string, typeof msgs>();
  for (const m of msgs) byConv.set(m.conversation_id, [...(byConv.get(m.conversation_id) ?? []), m]);
  const recent: RecentQuestion[] = [];
  const turns: Array<ThreadTurn & { at: string }> = [];
  for (const thread of byConv.values()) {
    thread.forEach((m, i) => {
      if (m.role === "parent" && m.reason === "to_staff") {
        const reply = thread.slice(i + 1).find((x) => x.role === "staff");
        if (reply) replies.push({ id: `msg:${reply.id}`, kind: "message", about: m.text, text: reply.text, at: reply.created_at, by: who(reply.author_id) });
        else pending.push({ id: `msg:${m.id}`, kind: "message", text: m.text, at: m.created_at });
      } else if (m.role === "parent") {
        const a = thread.slice(i + 1).find((x) => x.role === "assistant");
        if (a) {
          recent.push({ id: m.id, question: m.text, answer: a.card?.headline ?? a.text, outcome: a.outcome ?? "answered", at: m.created_at });
          // Older answers saved only as text show as a plain card.
          const card = a.card ?? { outcome: a.outcome ?? "answered", headline: a.text, body: "", facts: [], steps: [], events: [], citations: [], followUps: [] };
          turns.push({ id: m.id, question: m.text, card, messageId: a.id, feedback: a.feedback, at: m.created_at });
        }
      }
    });
  }

  // A question the bot couldn't answer shows where it stands now: the staff answer, or still waiting.
  const key = (q: string) => q.trim().toLowerCase().replace(/[?!.\s]+$/, "");
  for (const r of recent) {
    if (r.outcome !== "unsure") continue;
    const reply = replies.find((x) => x.kind === "answer" && key(x.about) === key(r.question));
    if (reply) Object.assign(r, { outcome: "staff", answer: `${reply.by?.name.split(" ")[0] ?? "Staff"} answered: ${reply.text}` });
    else if (pending.some((x) => key(x.text) === key(r.question))) r.answer = "Waiting on the front desk.";
  }

  // In the chat thread too: once staff answer a question, their answer stands in for "I don't have that".
  for (const t of turns) {
    if ((t.card as { outcome?: string }).outcome !== "unsure") continue;
    const reply = replies.find((x) => x.kind === "answer" && key(x.about) === key(t.question));
    if (reply) t.card = { outcome: "answered", kind: "answer", headline: reply.text, body: `${reply.by?.name.split(" ")[0] ?? "Staff"} from the front desk answered this.`, facts: [], steps: [], events: [], citations: [], followUps: [], handoff: null, openNow: null };
  }

  const newest = <T extends { at: string }>(xs: T[]) => xs.sort((a, b) => b.at.localeCompare(a.at));
  // One row per question: the latest time it was asked.
  const seen = new Set<string>();
  const uniqueRecent = newest(recent).filter((r) => {
    const k = r.question.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  // The chat drawer's thread: the last 20 questions, oldest first, so the newest sits by the input.
  const chat = newest(turns).slice(0, 20).reverse().map((t) => ({ id: t.id, question: t.question, card: t.card, messageId: t.messageId, feedback: t.feedback }));
  return { replies: newest(replies).slice(0, 4), pending: newest(pending).slice(0, 4), recent: uniqueRecent.slice(0, 5), thread: chat };
}
