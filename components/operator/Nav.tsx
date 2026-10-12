"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Inbox, MessagesSquare, BookOpen, ShieldCheck, PlugZap } from "lucide-react";

export const NAV = [
  { href: "/operator", label: "Home", short: "Home", icon: LayoutDashboard, badge: null },
  { href: "/operator/inbox", label: "Inbox", short: "Inbox", icon: Inbox, badge: "gaps" },
  { href: "/operator/conversations", label: "Conversations", short: "Chats", icon: MessagesSquare, badge: "waiting" },
  { href: "/operator/knowledge", label: "Knowledge", short: "Knowledge", icon: BookOpen, badge: null },
  { href: "/operator/privacy", label: "Privacy Guard", short: "Privacy", icon: ShieldCheck, badge: "held" },
  { href: "/operator/sources", label: "Sources", short: "Sources", icon: PlugZap, badge: null },
] as const;

export type Counts = { gaps: number; held: number; waiting: number };

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/operator" ? path === href : path.startsWith(href));
}

export function SideNav({ counts }: { counts: Counts | null }) {
  const active = useActive();
  return (
    <ul className="space-y-0.5">
      {NAV.map((n) => {
        const on = active(n.href);
        const count = n.badge && counts ? counts[n.badge] : 0;
        return (
          <li key={n.href}>
            <Link
              href={n.href}
              aria-current={on ? "page" : undefined}
              className={`group flex h-10 items-center gap-3 rounded-[10px] px-3 text-dense font-medium transition-colors ${on ? "bg-accent-tint text-accent" : "text-muted hover:bg-sunken hover:text-ink"}`}
            >
              <n.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
              <span className="flex-1">{n.label}</span>
              {count ? (
                <span className={`tabular min-w-5 rounded-full px-1.5 text-center text-caption font-bold ${n.badge === "held" ? "bg-warning-tint text-warning-ink" : "bg-accent text-on-accent"}`}>
                  {count}
                  <span className="sr-only"> {n.badge === "held" ? "items held for review" : n.badge === "gaps" ? "open questions" : "waiting for a reply"}</span>
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function TabBar({ counts }: { counts: Counts | null }) {
  const active = useActive();
  return (
    <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-30 border-t border-line-soft bg-surface/92 backdrop-blur-xl lg:hidden" style={{ paddingBottom: "var(--safe-bottom)" }}>
      <ul className="mx-auto grid max-w-xl grid-cols-6">
        {NAV.map((n) => {
          const on = active(n.href);
          const count = n.badge && counts ? counts[n.badge] : 0;
          return (
            <li key={n.href}>
              <Link href={n.href} aria-current={on ? "page" : undefined} className={`relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${on ? "text-accent" : "text-muted"}`}>
                <n.icon className="h-5 w-5" aria-hidden />
                {n.short}
                {count ? <span className={`absolute right-[22%] top-1.5 h-2 w-2 rounded-full ${n.badge === "held" ? "bg-warning" : "bg-accent"}`} aria-label={`${count} new`} /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
