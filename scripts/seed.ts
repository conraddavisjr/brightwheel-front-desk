/**
 * Seed the demo: two fictional schools, their people, connected sources,
 * Privacy Guard presets, every seed document through the real ingest
 * pipeline (so findings, visibility and chunks are produced by the product,
 * not by hand), their calendars, and 30 days of synthetic activity for the
 * dashboard (marked reason = 'seed_history').
 *
 * Run: npm run seed            (stub embeddings, $0)
 *      AI_STUB=0 npm run seed  (with GEMINI_API_KEY: live embeddings and AI review)
 *
 * Idempotent: it wipes and recreates the two demo schools.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { db, must, ok } from "@/lib/db/client";
import { ingestDocument, schoolPrivacyContext } from "@/lib/ingest/ingest";
import { csvToMarkdown, parseFrontmatter } from "@/lib/ingest/normalize";
import { PRESET_RULES } from "@/lib/privacy/presets";
import { normalizeQuestion, topicOf } from "@/lib/guard/router";
import { zonedMidnight } from "@/lib/time";
import { searchKnowledge } from "@/lib/retrieval/search";
import { config } from "@/lib/config";
import { manualSource } from "@/lib/operator/manualSource";
import { screenEvent } from "@/lib/privacy/events";

const ROOT = join(process.cwd(), "seed");

/** The real page in the demo workspace (seed/links.json); a published Notion site opens it publicly. */
const LINKS = JSON.parse(readFileSync(join(ROOT, "links.json"), "utf8")) as Record<string, Record<string, { notion?: string; doc?: string; sheet?: string }>>;
function originalUrl(slug: string, file: string): string | null {
  const link = LINKS[slug]?.[file];
  if (link?.notion) return config.integrations.notion.publicSite ? `https://${config.integrations.notion.publicSite}/${link.notion}` : `https://www.notion.so/${link.notion}`;
  if (link?.doc) return `https://docs.google.com/document/d/${link.doc}/view`;
  if (link?.sheet) return `https://docs.google.com/spreadsheets/d/${link.sheet}/view`;
  return null;
}

/** The real workspace behind a demo source, so its name on Sources links out. */
function sourceLink(slug: string, kind: string): string | null {
  const ids = (LINKS["$sources"] as unknown as Record<string, Record<string, string>>)[slug] ?? {};
  if (kind === "notion" && ids.notion) return config.integrations.notion.publicSite ? `https://${config.integrations.notion.publicSite}/${ids.notion}` : `https://www.notion.so/${ids.notion}`;
  if (kind === "drive" && ids.drive) return `https://drive.google.com/drive/folders/${ids.drive}`;
  if ((kind === "ical" || kind === "calendar") && ids.calendar) return `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(ids.calendar)}&ctz=America%2FLos_Angeles`;
  return null;
}

const SCHOOLS = [
  {
    slug: "sunflower-valley",
    name: "Sunflower Valley Early Learning",
    short_name: "Sunflower Valley",
    tagline: "Infants through pre-K in Oakland",
    city: "Oakland, CA",
    timezone: "America/Los_Angeles",
    phone: "(510) 555-0147",
    email: "hello.sunflower@example.com",
    address: "4120 Linden Grove Avenue, Oakland, CA 94611",
    ages: "6 weeks to 5 years",
    hours: { mon: ["07:00", "18:00"], tue: ["07:00", "18:00"], wed: ["07:00", "18:00"], thu: ["07:00", "18:00"], fri: ["07:00", "18:00"], sat: null, sun: null },
    director: { name: "Marisol Okafor", email: "marisol.okafor@example.com", hue: 268 },
    sources: [{ kind: "notion", name: "Notion", account_label: "Sunflower Valley workspace", dir: "notion" }],
    calendar: { kind: "ical", name: "School calendar", account_label: "Family calendar (iCal)" },
  },
  {
    slug: "harbor-kids",
    name: "Harbor Kids Montessori",
    short_name: "Harbor Kids",
    tagline: "Montessori for toddlers through kindergarten in Ballard",
    city: "Seattle, WA",
    timezone: "America/Los_Angeles",
    phone: "(206) 555-0183",
    email: "office.harborkids@example.com",
    address: "5418 Ballard Commons Way NW, Seattle WA 98107",
    ages: "18 months to kindergarten",
    hours: { mon: ["07:30", "17:30"], tue: ["07:30", "17:30"], wed: ["07:30", "17:30"], thu: ["07:30", "17:30"], fri: ["07:30", "17:30"], sat: null, sun: null },
    director: { name: "Gretchen Lindqvist", email: "gretchen.lindqvist@example.com", hue: 187 },
    sources: [
      { kind: "notion", name: "Notion", account_label: "Harbor Kids team space", dir: "notion" },
      { kind: "drive", name: "Google Drive", account_label: "office.harborkids@example.com", dir: "drive" },
    ],
    calendar: { kind: "ical", name: "Google Calendar (public iCal)", account_label: "Harbor Kids Family Calendar" },
  },
] as const;

const PARENTS: Record<string, Array<{ name: string; child: string; room: string; hue: number }>> = {
  "sunflower-valley": [
    { name: "Priya Raman", child: "Leo", room: "Sprouts", hue: 12 },
    { name: "Jordan Ellis", child: "Mila", room: "Blossoms", hue: 200 },
    { name: "Camila Torres", child: "Mateo", room: "Seedlings", hue: 330 },
    { name: "Sam Whitaker", child: "Ivy", room: "Saplings", hue: 150 },
    { name: "Aisha Bello", child: "Zara", room: "Sunbeams", hue: 40 },
    { name: "Kenji Watanabe", child: "Hana", room: "Sprouts", hue: 260 },
    { name: "Rachel Kim", child: "Noah", room: "Blossoms", hue: 100 },
    { name: "Luis Navarro", child: "Sofia", room: "Saplings", hue: 300 },
    { name: "Emma Johansson", child: "Axel", room: "Seedlings", hue: 180 },
    { name: "Tasha Greene", child: "Malik", room: "Sunbeams", hue: 20 },
  ],
  "harbor-kids": [
    { name: "Maya Chen-Ortiz", child: "Lucas", room: "Orcas", hue: 340 },
    { name: "Daniel Okoro", child: "Ada", room: "Puffins", hue: 210 },
    { name: "Hannah Schultz", child: "Felix", room: "Otters", hue: 120 },
    { name: "Arjun Mehta", child: "Riya", room: "Orcas", hue: 30 },
    { name: "Grace Lee", child: "Owen", room: "Puffins", hue: 280 },
    { name: "Marco Rossi", child: "Giulia", room: "Otters", hue: 170 },
    { name: "Fatima Hassan", child: "Yusuf", room: "Orcas", hue: 50 },
    { name: "Olivia Brooks", child: "Theo", room: "Puffins", hue: 230 },
    { name: "Ben Carter", child: "June", room: "Otters", hue: 90 },
    { name: "Sofia Alvarez", child: "Diego", room: "Orcas", hue: 310 },
  ],
};

// Questions families asked over the past month, with how it went. Mirrors real front-desk volume:
// illness and calendar dominate, and a few legitimate questions had no answer yet (those become gaps).
const HISTORY: Array<{ q: string; outcome: "answered" | "unsure" | "handoff" | "declined" | "care"; weight: number; up?: number; down?: number; a?: string }> = [
  { q: "Is my kid too sick to come in with a low fever?", outcome: "answered", weight: 14, up: 0.7, down: 0.05, a: "Children need to be fever-free (under 100.4°F) for 24 hours without fever-reducing medicine before returning." },
  { q: "What time do you close?", outcome: "answered", weight: 10, up: 0.5, a: "We're open until closing time Monday through Friday." },
  { q: "When is picture day?", outcome: "answered", weight: 9, up: 0.6, a: "Picture day is coming up this month; the event card has the date." },
  { q: "How much is tuition for the toddler room?", outcome: "answered", weight: 8, up: 0.4, down: 0.08, a: "Toddler tuition is listed in the tuition table by schedule." },
  { q: "Are you closed for Thanksgiving?", outcome: "answered", weight: 8, up: 0.6, a: "Yes, closed Thursday and Friday of Thanksgiving week." },
  { q: "What's for lunch this week?", outcome: "answered", weight: 7, up: 0.5, a: "This week's menu is in the menu card." },
  { q: "Can I book a tour?", outcome: "answered", weight: 6, up: 0.5, a: "Tours are offered weekly; book through the tour form or call the front desk." },
  { q: "What is the late pickup fee?", outcome: "answered", weight: 5, up: 0.3, down: 0.1, a: "Late pickup is $1 per minute after closing." },
  { q: "Do I need to send extra clothes?", outcome: "answered", weight: 4, up: 0.4, a: "Yes, please keep two sets of weather-appropriate extra clothes in your child's cubby." },
  { q: "Is there a sibling discount?", outcome: "answered", weight: 4, up: 0.3, down: 0.1, a: "Yes, siblings receive a discount on the lower tuition." },
  { q: "What should my child bring for nap time?", outcome: "answered", weight: 3, up: 0.4, a: "A small blanket and crib sheet, taken home weekly to wash." },
  { q: "Do you offer a summer camp?", outcome: "unsure", weight: 5 },
  { q: "Is there parking for drop off?", outcome: "unsure", weight: 4 },
  { q: "Do you have a flu shot clinic this year?", outcome: "unsure", weight: 3 },
  { q: "Can grandparents visit for lunch?", outcome: "unsure", weight: 3 },
  { q: "Did my daughter nap today?", outcome: "handoff", weight: 4 },
  { q: "What's the door code?", outcome: "declined", weight: 1 },
  { q: "Which kids have lice?", outcome: "declined", weight: 1 },
];

function rand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

async function wipe() {
  const client = db();
  for (const s of SCHOOLS) await client.from("schools").delete().eq("slug", s.slug);
  await client.from("rate_limits").delete().neq("key", "");
}

async function main() {
  const client = db();
  console.log("Seeding demo schools…");
  await wipe();

  for (const def of SCHOOLS) {
    const school = must(
      await client
        .from("schools")
        .insert({ slug: def.slug, name: def.name, short_name: def.short_name, tagline: def.tagline, city: def.city, timezone: def.timezone, phone: def.phone, email: def.email, address: def.address, ages: def.ages, hours: def.hours })
        .select("id")
        .single(),
      "school",
    );
    const schoolId: string = school.id;

    const director = must(
      await client.from("people").insert({ school_id: schoolId, role: "director", name: def.director.name, email: def.director.email, avatar_hue: def.director.hue }).select("id").single(),
      "director",
    );
    const parents = must(
      await client
        .from("people")
        .insert(PARENTS[def.slug].map((p, i) => ({ school_id: schoolId, role: "parent", name: p.name, email: `${p.name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`, avatar_hue: p.hue, children: [{ name: p.child, room: p.room }], created_at: new Date(Date.now() - (90 - i) * 86400000).toISOString() })))
        .select("id,name"),
      "parents",
    ) as Array<{ id: string; name: string }>;

    ok(
      await client.from("privacy_rules").insert(PRESET_RULES.map((r) => ({ school_id: schoolId, category: r.category, name: r.name, description: r.description, pattern: null, preset: true, enabled: true }))),
      "rules",
    );

    const ctx = await schoolPrivacyContext(schoolId);
    for (const s of def.sources) {
      const source = must(
        await client.from("sources").insert({ school_id: schoolId, kind: s.kind, name: s.name, account_label: s.account_label, status: "connected", config: { demo: true, link: sourceLink(def.slug, s.kind) }, last_synced_at: new Date().toISOString() }).select("id").single(),
        "source",
      );
      const dir = join(ROOT, def.slug, s.dir);
      for (const file of readdirSync(dir).sort()) {
        const raw = readFileSync(join(dir, file), "utf8");
        const ext = extname(file);
        let title = basename(file, ext);
        let content = raw;
        let emoji: string | null = null;
        let parentTitle: string | null = null;
        let updated: string | null = null;
        if (ext === ".md") {
          const { meta, body } = parseFrontmatter(raw);
          title = meta.title ?? title;
          emoji = meta.emoji ?? null;
          parentTitle = meta.parent ?? null;
          updated = meta.updated ?? null;
          content = body;
        } else if (ext === ".csv") {
          content = csvToMarkdown(title, raw);
          emoji = "📊";
        }
        const kindLabel = s.kind === "drive" ? (ext === ".csv" ? "Google Sheet" : "Google Doc") : "Notion page";
        const res = await ingestDocument(
          {
            schoolId,
            sourceId: source.id,
            externalId: file,
            title,
            content,
            emoji: emoji ?? (s.kind === "drive" ? "📄" : null),
            parentTitle,
            url: originalUrl(def.slug, file),
            mime: ext === ".csv" ? "text/csv" : "text/markdown",
            sourceUpdatedAt: updated ? new Date(`${updated}T12:00:00-07:00`).toISOString() : new Date(Date.now() - 20 * 86400000).toISOString(),
          },
          { ctx },
        );
        console.log(`  ${def.short_name} · ${kindLabel} · ${title}: ${res.visibility}, ${res.findings} findings, ${res.chunks} chunks`);
      }
    }

    // Calendar.
    const cal = JSON.parse(readFileSync(join(ROOT, def.slug, "calendar.json"), "utf8")) as {
      timeZone: string;
      events: Array<{ id: string; title: string; start: string; end: string; allDay: boolean; location: string; description: string; visibility: string }>;
    };
    const calSource = must(
      await client
        .from("sources")
        .insert({ school_id: schoolId, kind: def.calendar.kind, name: def.calendar.name, account_label: def.calendar.account_label, status: "connected", config: { url: `${process.env.APP_URL ?? "http://localhost:3000"}/demo/${def.slug}/calendar.ics`, link: sourceLink(def.slug, def.calendar.kind) }, last_synced_at: new Date().toISOString() })
        .select("id")
        .single(),
      "calendar source",
    );
    const toTs = (d: string, allDay: boolean) => (allDay ? zonedMidnight(d, cal.timeZone).toISOString() : new Date(d).toISOString());
    ok(
      await client.from("events").insert(
        cal.events.map((raw) => {
          // The same Privacy Guard check a live calendar sync runs.
          const e = screenEvent({ ...raw, location: raw.location || null, description: raw.description || null }, ctx);
          return {
            school_id: schoolId,
            source_id: calSource.id,
            external_id: e.id,
            title: e.title,
            starts_at: toTs(e.start, e.allDay),
            ends_at: e.end ? toTs(e.end, e.allDay) : null,
            all_day: e.allDay,
            location: e.location,
            description: e.description,
            visibility: e.visibility === "private" || e.staffOnly ? "staff" : "family",
          };
        }),
      ),
      "events",
    );
    console.log(`  ${def.short_name} · calendar: ${cal.events.length} events`);

    await seedHistory(schoolId, parents, def.slug === "harbor-kids" ? 2 : 1);
    await seedPersona(schoolId, def.slug, parents, director.id, ctx);
  }
  console.log("Done.");
}

/** 30 days of conversations shaped like real use: weekday mornings, an illness-season bump, a picture-day spike. */
async function seedHistory(schoolId: string, parents: Array<{ id: string; name: string }>, seed: number) {
  const client = db();
  const r = rand(seed * 7919);
  const total = HISTORY.reduce((s, h) => s + h.weight, 0);
  const pick = () => {
    let x = r() * total;
    for (const h of HISTORY) if ((x -= h.weight) <= 0) return h;
    return HISTORY[0];
  };
  // Cite what the real search would cite, so "Most-used sources" reflects the school's actual documents.
  const citeFor = new Map<string, Array<{ documentId: string; title: string; heading: string }>>();
  for (const h of HISTORY.filter((x) => x.outcome === "answered")) {
    const r = await searchKnowledge(schoolId, h.q, 3);
    citeFor.set(h.q, r.passages.slice(0, 2).map((p) => ({ documentId: p.documentId, title: p.title, heading: p.heading })));
  }
  // Surface a real source conflict, found by the same detector parents trigger.
  const conflict = (await searchKnowledge(schoolId, "When can my child come back after a fever? What temperature counts as a fever?", 6)).conflict;
  if (conflict) {
    ok(
      await client.from("gaps").insert({
        school_id: schoolId,
        question: "Is my kid too sick to come in with a low fever?",
        normalized: `conflict ${[conflict.a.documentId, conflict.b.documentId].sort().join(" ")}`,
        topic: "illness",
        kind: "conflict",
        note: conflict.note,
        ask_count: 9,
        first_asked_at: new Date(Date.now() - 12 * 86400000).toISOString(),
        last_asked_at: new Date(Date.now() - 86400000).toISOString(),
      }),
      "conflict gap",
    );
  }
  const now = Date.now();
  const convRows: Array<Record<string, unknown>> = [];
  const msgRows: Array<Record<string, unknown>> = [];
  const gapCounts = new Map<string, { q: string; ids: Set<string>; first: number; last: number }>();

  for (let day = 29; day >= 1; day--) {
    const date = new Date(now - day * 86400000);
    const dow = date.getUTCDay();
    const weekend = dow === 0 || dow === 6;
    // A bump mid-month (fall illness wave) and a spike 6 days ago (picture-day reminders).
    const base = weekend ? 2 : 7;
    const bump = day >= 12 && day <= 16 ? 6 : 0;
    const spike = day === 6 ? 14 : day === 5 ? 8 : 0;
    const n = Math.round(base + bump + spike + r() * 4);
    for (let i = 0; i < n; i++) {
      const h = spike && r() < 0.5 ? HISTORY[2] : bump && r() < 0.4 ? HISTORY[0] : pick();
      const parent = parents[Math.floor(r() * parents.length)];
      const at = new Date(date);
      at.setUTCHours(13 + Math.floor(r() * 11), Math.floor(r() * 60), 0, 0);
      const convId = crypto.randomUUID();
      convRows.push({ id: convId, school_id: schoolId, parent_id: parent.id, channel: r() < 0.18 ? "voice" : r() < 0.3 ? "guided" : "text", started_at: at.toISOString(), last_at: at.toISOString() });
      msgRows.push({ conversation_id: convId, school_id: schoolId, role: "parent", text: h.q, author_id: parent.id, citations: [], created_at: at.toISOString() });
      const fb = h.outcome === "answered" ? (r() < (h.up ?? 0.4) ? 1 : r() < (h.down ?? 0.03) ? -1 : null) : h.outcome === "unsure" && r() < 0.2 ? -1 : null;
      msgRows.push({
        conversation_id: convId,
        school_id: schoolId,
        role: "assistant",
        text: h.a ?? (h.outcome === "unsure" ? "I don't have that yet. I've passed your question to the front desk." : h.outcome === "handoff" ? "I can't see your child's records, but your teachers can." : "I can't share that."),
        outcome: h.outcome,
        reason: "seed_history",
        topic: topicOf(h.q),
        latency_ms: 900 + Math.floor(r() * 1800),
        citations: h.outcome === "answered" ? (citeFor.get(h.q) ?? []) : [],
        feedback: fb,
        created_at: new Date(at.getTime() + 2000).toISOString(),
      });
      if (h.outcome === "unsure") {
        const key = normalizeQuestion(h.q);
        const g = gapCounts.get(key) ?? { q: h.q, ids: new Set<string>(), first: at.getTime(), last: at.getTime() };
        g.ids.add(parent.id);
        g.last = Math.max(g.last, at.getTime());
        gapCounts.set(key, g);
      }
    }
  }
  for (let i = 0; i < convRows.length; i += 500) ok(await client.from("conversations").insert(convRows.slice(i, i + 500)), "conversations");
  for (let i = 0; i < msgRows.length; i += 500) ok(await client.from("messages").insert(msgRows.slice(i, i + 500)), "messages");
  ok(
    await client.from("gaps").insert(
      [...gapCounts.entries()].map(([normalized, g]) => ({
        school_id: schoolId,
        question: g.q,
        normalized,
        topic: topicOf(g.q),
        ask_count: g.ids.size + Math.floor(g.ids.size / 2),
        asker_ids: [...g.ids],
        first_asked_at: new Date(g.first).toISOString(),
        last_asked_at: new Date(g.last).toISOString(),
      })),
    ),
    "gaps",
  );
  console.log(`  history: ${convRows.length} conversations, ${gapCounts.size} open gaps`);
}

/**
 * The parent you enter the demo as gets a lived-in home screen: a question the
 * director already answered (published as a knowledge page, like the Inbox
 * does), a quick thread with staff, and two things still waiting.
 */
const PERSONAS: Record<string, { name: string; answered: { q: string; title: string; a: string }; thread: { ask: string; reply: string }; pendingGap: string; pendingMessage: string }> = {
  "harbor-kids": {
    name: "Maya Chen-Ortiz",
    answered: { q: "Can grandparents visit for lunch?", title: "Grandparents at lunch", a: "Yes! Grandparents are welcome to join lunch on Fridays from 11:30 to 12:15. Please sign in at the front desk with ID, and let your child's teachers know the day before so we can set an extra place." },
    thread: { ask: "Lucas has a dentist appointment Thursday morning, so he'll arrive around 10:30.", reply: "Thanks for the heads up, Maya! We'll save Lucas a snack and see him at 10:30." },
    pendingGap: "Do you offer a summer camp?",
    pendingMessage: "Could Lucas move up to the Otters room in January? He's been talking about it nonstop.",
  },
  "sunflower-valley": {
    name: "Priya Raman",
    answered: { q: "Can we bring cupcakes for a birthday?", title: "Birthday treats", a: "Yes, birthday treats are welcome! Please bring store-bought treats with the ingredient label, and tell your child's teacher two days ahead. We serve them at afternoon snack." },
    thread: { ask: "Leo's grandma will pick him up on Friday. She's already on our pickup list.", reply: "Got it, thanks Priya! We'll check her ID at pickup. Have a great weekend." },
    pendingGap: "Do you offer a summer camp?",
    pendingMessage: "Is there space for Leo to move up to the Blossoms room in March?",
  },
};

async function seedPersona(schoolId: string, slug: string, parents: Array<{ id: string; name: string }>, directorId: string, ctx: Awaited<ReturnType<typeof schoolPrivacyContext>>) {
  const client = db();
  const def = PERSONAS[slug];
  const me = parents.find((p) => p.name === def.name);
  if (!def || !me) return;
  const hours = (h: number) => new Date(Date.now() - h * 3600000).toISOString();

  // A question the director answered yesterday: published to knowledge, the family notified.
  const page = await ingestDocument(
    { schoolId, sourceId: await manualSource(schoolId), externalId: `answer:${normalizeQuestion(def.answered.q)}`, title: def.answered.title, content: `# ${def.answered.title}\n\n${def.answered.a}`, emoji: "💬", parentTitle: null, url: null, mime: "text/markdown", sourceUpdatedAt: hours(20) },
    { ctx },
  );
  const answered = { status: "answered", answer: def.answered.a, answer_document_id: page.documentId, answered_by: directorId, answered_at: hours(20), notified_at: hours(20) };
  const { data: existing } = await client.from("gaps").select("id,asker_ids").eq("school_id", schoolId).eq("normalized", normalizeQuestion(def.answered.q)).maybeSingle();
  if (existing) ok(await client.from("gaps").update({ ...answered, asker_ids: [...new Set([...existing.asker_ids, me.id])] }).eq("id", existing.id), "answered gap");
  else ok(await client.from("gaps").insert({ school_id: schoolId, question: def.answered.q, normalized: normalizeQuestion(def.answered.q), topic: topicOf(def.answered.q), asker_ids: [me.id], first_asked_at: hours(30), last_asked_at: hours(30), ...answered }), "answered gap");

  // Still waiting: an open question and a message to staff.
  const { data: open } = await client.from("gaps").select("id,asker_ids").eq("school_id", schoolId).eq("normalized", normalizeQuestion(def.pendingGap)).maybeSingle();
  if (open) ok(await client.from("gaps").update({ asker_ids: [...new Set([...open.asker_ids, me.id])], last_asked_at: hours(3) }).eq("id", open.id), "pending gap");
  else ok(await client.from("gaps").insert({ school_id: schoolId, question: def.pendingGap, normalized: normalizeQuestion(def.pendingGap), topic: topicOf(def.pendingGap), asker_ids: [me.id], first_asked_at: hours(3), last_asked_at: hours(3) }), "pending gap");

  // Each ask lives in its own conversation, the way the app records them.
  const thread = crypto.randomUUID();
  const waiting = crypto.randomUUID();
  const asked = crypto.randomUUID();
  ok(
    await client.from("conversations").insert([
      { id: thread, school_id: schoolId, parent_id: me.id, channel: "text", started_at: hours(50), last_at: hours(49) },
      { id: waiting, school_id: schoolId, parent_id: me.id, channel: "text", started_at: hours(5), last_at: hours(5) },
      { id: asked, school_id: schoolId, parent_id: me.id, channel: "text", started_at: hours(30), last_at: hours(30) },
    ]),
    "persona conversations",
  );
  ok(
    await client.from("messages").insert([
      { conversation_id: thread, school_id: schoolId, role: "parent", text: def.thread.ask, reason: "to_staff", author_id: me.id, citations: [], created_at: hours(50) },
      { conversation_id: thread, school_id: schoolId, role: "staff", text: def.thread.reply, reason: "staff_reply", author_id: directorId, citations: [], created_at: hours(49) },
      { conversation_id: waiting, school_id: schoolId, role: "parent", text: def.pendingMessage, reason: "to_staff", author_id: me.id, citations: [], created_at: hours(5) },
      { conversation_id: asked, school_id: schoolId, role: "parent", text: def.answered.q, author_id: me.id, citations: [], created_at: hours(30) },
      { conversation_id: asked, school_id: schoolId, role: "assistant", text: "I don't have that yet. I've passed your question to the front desk.", outcome: "unsure", reason: "seed_history", topic: topicOf(def.answered.q), citations: [], created_at: new Date(Date.now() - 30 * 3600000 + 2000).toISOString() },
    ]),
    "persona messages",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
