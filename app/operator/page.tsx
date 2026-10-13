import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight, ArrowDownRight, MessageCircleQuestion, ShieldCheck, Sparkles, ThumbsUp, Clock, Bot, FileText, Inbox, CheckCircle2 } from "lucide-react";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { computeStats, navCounts, openGaps, recentMessages } from "@/lib/db/operator";
import { person, schoolForSession } from "@/lib/db/queries";
import { db } from "@/lib/db/client";
import { HowItWorksBanner } from "@/components/operator/HowItWorksBanner";
import { UsageChart } from "@/components/operator/UsageChart";
import { IntegrationTiles } from "@/components/operator/IntegrationTiles";
import { Pill } from "@/components/ui/Pill";
import { SourcesUsage } from "@/components/operator/SourcesUsage";
import { normalizeQuestion } from "@/lib/guard/router";
import { PageHeader, Panel } from "@/components/operator/Panel";
import { SchoolLogo } from "@/components/brand/SchoolLogo";
import { TOPIC_LABEL, OUTCOME_PILL } from "@/components/operator/labels";

export const metadata: Metadata = { title: "Home" };

export default function OperatorHome() {
  return (
    <main className="mx-auto max-w-[1180px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {/* Phones have the school's logo and name in the header already; vertical space goes to the work. */}
      <div className="hidden lg:block">
        <Suspense fallback={<div className="shimmer h-16 w-80 rounded-[16px]" />}>
          <Greeting />
        </Suspense>
      </div>
      <HowItWorksBanner />
      <Suspense fallback={<HomeSkeleton />}>
        <Dashboard />
      </Suspense>
    </main>
  );
}

async function director() {
  const s = await getSession();
  if (!s || s.role === "parent") redirect("/");
  return s;
}

async function Greeting() {
  const s = await director();
  const [me, school] = await Promise.all([person(s.personId), schoolForSession(s)]);
  return <PageHeader leading={<SchoolLogo slug={school.slug} size={80} fill className="shadow-1" />} title={`Welcome back, ${me.name.split(" ")[0]}`} subtitle={`Here's how Front Desk helped ${school.short_name} families in the last 30 days.`} />;
}

function HomeSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="shimmer h-[118px] rounded-[16px]" />
        ))}
      </div>
      <div className="shimmer h-[280px] rounded-[16px]" />
    </div>
  );
}

async function Dashboard() {
  const s = await director();
  const school = await schoolForSession(s);
  const [msgs, gaps, counts, sources] = await Promise.all([
    recentMessages(s.schoolId, 30),
    openGaps(s.schoolId),
    navCounts(s.schoolId),
    db().from("sources").select("id,kind,name,status,account_label,last_synced_at").eq("school_id", s.schoolId),
  ]);
  const st = computeStats(msgs, 30, school.timezone);
  const open = gaps.filter((g) => g.status === "open");
  const hot = open.filter((g) => g.kind === "question").sort((a, b) => b.ask_count - a.ask_count)[0];
  const conflicts = open.filter((g) => g.kind === "conflict");
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  return (
    <>
      {hot ? (
        <Link href={`/operator/inbox?gap=${hot.id}`} className="ai-ring group flex items-center gap-4 rounded-[20px] bg-surface p-4 shadow-ai transition hover:-translate-y-0.5 sm:p-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ai-tint text-ai-ink">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-caption font-semibold uppercase tracking-[0.08em] text-ai-ink">Spotlight</span>
            <span className="mt-0.5 block text-headline font-semibold text-ink">
              &ldquo;{hot.question}&rdquo; was asked {hot.ask_count} times{hot.asker_ids.length > 1 ? ` by ${hot.asker_ids.length} families` : ""}, and we had no answer.
            </span>
            <span className="block text-dense text-muted">Answer it once and Front Desk handles it from now on.</span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-accent transition group-hover:translate-x-0.5" aria-hidden />
        </Link>
      ) : null}

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={MessageCircleQuestion} tint="bg-accent-tint text-accent" label="Questions answered" value={st.answered.toLocaleString()} sub={`of ${st.questions.toLocaleString()} asked`} trend={st.trend} />
        <Stat icon={Bot} tint="bg-teal-tint text-teal-ink" label="Answered without staff" value={pct(st.deflection)} sub={`${st.unsure + st.handedOff} went to a person`} />
        <Stat icon={Clock} tint="bg-success-tint text-success-ink" label="Staff time saved" value={`${st.hoursSaved}h`} sub="at 4 min per question" />
        <Stat icon={ThumbsUp} tint="bg-pink-tint text-pink-ink" label="Rated helpful" value={st.helpfulRate === null ? "-" : pct(st.helpfulRate)} sub={`${st.ratings} ratings`} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <Panel title="Questions per day" subtitle="Spikes usually follow an event or an illness going around.">
          <UsageChart data={st.series} />
        </Panel>
        <Panel title="Needs your attention">
          <ul className="space-y-2">
            {/* Only what needs a decision: a zero here isn't an action. */}
            {counts.questions ? <Attention href="/operator/inbox" icon={Inbox} tint="bg-accent-tint text-accent" count={counts.questions} label="Questions without an answer" /> : null}
            {counts.privacy ? <Attention href="/operator/privacy" icon={ShieldCheck} tint="bg-warning-tint text-warning-ink" count={counts.privacy} label="Waiting in Privacy Guard" /> : null}
            {conflicts.length ? <Attention href={conflicts.length === 1 ? `/operator/inbox?gap=${conflicts[0].id}` : "/operator/inbox?kind=conflict"} icon={FileText} tint="bg-orange-tint text-orange-ink" count={conflicts.length} label="Documents that disagree" /> : null}
          </ul>
          {!counts.questions && !counts.privacy && !conflicts.length ? (
            <p className="flex items-center gap-2.5 rounded-[14px] bg-success-tint p-3 text-dense font-medium text-success-ink">
              <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden /> All caught up. Nothing needs you right now.
            </p>
          ) : null}
          <p className="mt-4 text-caption text-muted">
            Median answer time <span className="tabular font-semibold text-ink">{st.medianLatencyMs ? `${(st.medianLatencyMs / 1000).toFixed(1)}s` : "-"}</span> · {st.declined} unsafe requests declined
          </p>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Panel title="What families ask most" action={<Link href="/operator/conversations" className="text-label font-semibold text-accent hover:underline">All conversations</Link>}>
          <ol className="divide-y divide-line-soft">
            {st.topQuestions.map((q, i) => {
              // Unanswered: straight to its Inbox item to answer it. Otherwise: those conversations.
              const gap = q.outcome === "unsure" ? open.find((g) => g.kind === "question" && g.normalized === normalizeQuestion(q.question)) : undefined;
              const href = gap ? `/operator/inbox?gap=${gap.id}` : `/operator/conversations?q=${encodeURIComponent(q.question)}${q.outcome === "unsure" ? "&filter=unsure" : ""}`;
              return (
                <li key={q.question}>
                  <Link href={href} className="-mx-2 flex items-center gap-3 rounded-[12px] px-2 py-2.5 transition hover:bg-sunken">
                    <span className="tabular w-5 text-caption font-bold text-muted">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-dense font-medium text-ink">{q.question}</span>
                      <span className="text-caption text-muted">{TOPIC_LABEL[q.topic] ?? q.topic}</span>
                    </span>
                    <Pill tone={OUTCOME_PILL[q.outcome]?.tone ?? "neutral"}>{OUTCOME_PILL[q.outcome]?.label ?? q.outcome}</Pill>
                    <span className="tabular w-8 text-right text-dense font-semibold text-ink">{q.count}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </Panel>
        <Panel title="Most-used sources" subtitle="The documents doing the most work for you.">
          <SourcesUsage
            sources={st.topSources.map((src) => ({ key: src.documentId, label: src.title, count: src.count, href: `/operator/knowledge?doc=${src.documentId}` }))}
            topics={st.topics.slice(0, 8).map((t) => ({ key: t.topic, label: TOPIC_LABEL[t.topic] ?? t.topic, count: t.count }))}
          />
        </Panel>
      </div>

      <Panel title="Connected sources" subtitle="Front Desk reads from the tools you already keep up to date." action={<Link href="/operator/sources" className="text-label font-semibold text-accent hover:underline">Manage</Link>}>
        <IntegrationTiles sources={(sources.data ?? []) as Array<{ id: string; kind: string; name: string; status: string; account_label: string | null; last_synced_at: string | null }>} compact />
      </Panel>
    </>
  );
}

function Stat({ icon: Icon, tint, label, value, sub, trend }: { icon: React.ComponentType<{ className?: string }>; tint: string; label: string; value: string; sub: string; trend?: number | null }) {
  return (
    <div className="rounded-[16px] bg-surface p-4 shadow-1 ring-1 ring-line-soft">
      <div className="flex items-center justify-between">
        <span className={`grid h-8 w-8 place-items-center rounded-full ${tint}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        {trend !== undefined && trend !== null ? (
          <span className={`inline-flex items-center gap-0.5 text-caption font-semibold ${trend >= 0 ? "text-success-ink" : "text-muted"}`}>
            {trend >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />}
            {Math.abs(Math.round(trend * 100))}%<span className="sr-only"> versus the previous two weeks</span>
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-label font-medium text-muted">{label}</p>
      <p className="tabular text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink">{value}</p>
      <p className="text-caption text-muted">{sub}</p>
    </div>
  );
}

function Attention({ href, icon: Icon, tint, count, label }: { href: string; icon: React.ComponentType<{ className?: string }>; tint: string; count: number; label: string }) {
  return (
    <li>
      <Link href={href} className="flex min-h-14 items-center gap-3 rounded-[14px] p-2.5 transition hover:bg-sunken">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${tint}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="flex-1 text-dense font-medium text-ink">{label}</span>
        <span className="tabular text-headline font-bold text-ink">{count}</span>
        <ArrowRight className="h-4 w-4 text-muted" aria-hidden />
      </Link>
    </li>
  );
}
