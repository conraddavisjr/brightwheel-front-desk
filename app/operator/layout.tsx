import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Eye, Repeat } from "lucide-react";
import { getSession } from "@/lib/session";
import { navCounts } from "@/lib/db/operator";
import { person, schoolForSession } from "@/lib/db/queries";
import { SideNav, TabBar } from "@/components/operator/Nav";
import { WheelMark } from "@/components/brand/WheelMark";
import { Avatar } from "@/components/ui/Avatar";
import { ViewAsParent } from "@/components/operator/ViewAsParent";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function OperatorLayout({ children }: LayoutProps<"/operator">) {
  return (
    <div className="min-h-dvh bg-canvas-operator lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line-soft bg-surface px-3 py-4 lg:flex">
        <div className="flex items-center justify-between pb-3">
          <Link href="/operator" className="flex items-center gap-2 px-2">
            <WheelMark size={26} />
            <span className="text-[17px] font-bold tracking-[-0.02em] text-ink">brightwheel</span>
            <span className="whitespace-nowrap rounded-full bg-accent-tint px-2 py-0.5 text-caption font-semibold text-accent">Front Desk</span>
          </Link>
          <ThemeToggle className="h-9 w-9" />
        </div>
        <Suspense fallback={<SideNav counts={null} />}>
          <SideNavWithCounts />
        </Suspense>
        <div className="mt-auto">
          <Suspense fallback={<div className="shimmer h-16 rounded-[14px]" />}>
            <SchoolCard />
          </Suspense>
        </div>
      </aside>
      <div className="min-w-0 pb-24 lg:pb-0">
        <Suspense fallback={null}>
          <MobileHeader />
        </Suspense>
        {children}
      </div>
      <Suspense fallback={<TabBar counts={null} />}>
        <TabBarWithCounts />
      </Suspense>
    </div>
  );
}

async function requireDirector() {
  const s = await getSession();
  if (!s) redirect("/");
  if (s.role === "parent") redirect("/ask");
  return s;
}

async function SideNavWithCounts() {
  const s = await requireDirector();
  return <SideNav counts={await navCounts(s.schoolId)} />;
}
async function TabBarWithCounts() {
  const s = await requireDirector();
  return <TabBar counts={await navCounts(s.schoolId)} />;
}

async function SchoolCard() {
  const s = await requireDirector();
  const [school, me] = await Promise.all([schoolForSession(s), person(s.personId)]);
  return (
    <div className="rounded-[14px] bg-canvas-operator p-3 ring-1 ring-line-soft">
      <div className="flex items-center gap-2.5">
        <Avatar name={me.name} hue={me.avatar_hue} size={34} />
        <div className="min-w-0">
          <p className="truncate text-label font-semibold text-ink">{me.name}</p>
          <p className="truncate text-caption text-muted">Director · {school.short_name}</p>
        </div>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        <ViewAsParent school={school.slug as "sunflower-valley" | "harbor-kids"}>
          <Eye className="h-3.5 w-3.5" aria-hidden /> Parent view
        </ViewAsParent>
        <Link href="/" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-surface text-caption font-semibold text-ink ring-1 ring-line hover:bg-sunken">
          <Repeat className="h-3.5 w-3.5" aria-hidden /> Switch
        </Link>
      </div>
    </div>
  );
}

async function MobileHeader() {
  const s = await requireDirector();
  const school = await schoolForSession(s);
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2.5 border-b border-line-soft bg-surface/90 px-4 py-2.5 backdrop-blur-xl lg:hidden">
      <WheelMark size={24} />
      <p className="min-w-0 flex-1 truncate text-dense font-semibold text-ink">{school.name}</p>
      <ThemeToggle className="h-9 w-9" />
      <ViewAsParent school={school.slug as "sunflower-valley" | "harbor-kids"} compact>
        <Eye className="h-4 w-4" aria-hidden /> Parent view
      </ViewAsParent>
    </header>
  );
}
