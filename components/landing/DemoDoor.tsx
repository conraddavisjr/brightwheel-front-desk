"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { SchoolLogo } from "@/components/brand/SchoolLogo";
import { Avatar } from "@/components/ui/Avatar";

/**
 * A door into the demo: "Chat with Harbor Kids, as Maya". A plain link to
 * /demo/enter, which sets who you are and redirects; no sign-in step.
 */
export function DemoDoor({
  school,
  role,
  title,
  person,
  detail,
  variant = "primary",
}: {
  school: "sunflower-valley" | "harbor-kids";
  role: "director" | "parent";
  title: ReactNode;
  person: { name: string; firstName: string; hue: number };
  detail: string;
  variant?: "primary" | "secondary";
}) {
  const [pending, setPending] = useState(false);
  // Coming Back restores this page from the back/forward cache with the spinner still on.
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => e.persisted && setPending(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  const primary = variant === "primary";
  return (
    <a
      href={`/demo/enter?school=${school}&role=${role}`}
      onClick={() => setPending(true)}
      aria-busy={pending || undefined}
      className={`group flex min-h-16 w-full items-center gap-3 rounded-[20px] py-2.5 pl-2.5 pr-4 text-left transition-[background,transform,box-shadow] duration-150 active:scale-[0.99] ${
        primary ? "bg-accent text-on-accent shadow-2 hover:bg-accent-hover" : "bg-surface text-ink ring-1 ring-line hover:bg-accent-tint-2 hover:ring-line-strong"
      }`}
    >
      <span className={`grid shrink-0 place-items-center rounded-[14px] ${primary ? "bg-white/15 p-1" : "bg-sunken p-1"}`}>
        <SchoolLogo slug={school} size={36} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold leading-tight">{title}</span>
        <span className={`mt-1 flex items-center gap-1.5 text-caption ${primary ? "text-on-accent" : "text-muted"}`}>
          <Avatar name={person.name} hue={person.hue} size={20} className={primary ? "ring-1 ring-white/60" : "ring-1 ring-line-soft"} />
          <span className="truncate">
            <span className={`font-semibold ${primary ? "text-on-accent" : "text-ink"}`}>{person.firstName}</span> · {detail}
          </span>
        </span>
      </span>
      {pending ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />}
    </a>
  );
}
