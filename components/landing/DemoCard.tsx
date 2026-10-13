"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { SchoolLogo } from "@/components/brand/SchoolLogo";
import { Avatar } from "@/components/ui/Avatar";

const SCHOOL_NAMES = { "harbor-kids": "Harbor Kids Montessori", "sunflower-valley": "Sunflower Valley" } as const;

/**
 * A whole landing card that is one link into the demo: tap anywhere on it. The button at the
 * bottom says plainly where it goes. No sign-in step; /demo/enter sets who you are.
 */
export function DemoCard({
  school,
  role,
  cta,
  person,
  detail,
  children,
}: {
  school: "harbor-kids" | "sunflower-valley";
  role: "director" | "parent";
  cta: string;
  person: { name: string; firstName: string; hue: number };
  detail: string;
  children: ReactNode;
}) {
  const [pending, setPending] = useState(false);
  // Coming Back restores this page from the back/forward cache with the spinner still on.
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => e.persisted && setPending(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  return (
    <a
      href={`/demo/enter?school=${school}&role=${role}`}
      onClick={() => setPending(true)}
      aria-busy={pending || undefined}
      className="group flex flex-col rounded-[28px] bg-surface p-5 text-ink no-underline shadow-2 ring-1 ring-line-soft transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-3 focus-visible:ring-2 focus-visible:ring-accent sm:p-7"
    >
      {children}
      <span className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-5 text-[15px] font-semibold text-on-accent shadow-1 transition-colors group-hover:bg-accent-hover">
        {cta}
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />}
      </span>
      <span className="mt-3 flex items-center justify-center gap-2 text-caption text-muted">
        <SchoolLogo slug={school} size={18} />
        {SCHOOL_NAMES[school]}
        <span aria-hidden>·</span>
        <Avatar name={person.name} hue={person.hue} size={18} />
        {person.firstName}, {detail}
      </span>
    </a>
  );
}
