import Link from "next/link";
import { ChevronLeft, LogOut } from "lucide-react";
import { SchoolLogo } from "@/components/brand/SchoolLogo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

/** The parent app's header. On Chat it carries a breadcrumb back to Home. */
export function ParentHeader({ school, back = false }: { school: { slug: string; name: string; shortName: string; openNow: { open: boolean; label: string } }; back?: boolean }) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 bg-canvas/85 px-4 py-3 backdrop-blur-xl sm:px-6">
      {back ? (
        <Link href="/ask" aria-label="Back to home" className="-ml-2 grid h-11 w-9 shrink-0 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink">
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
      ) : null}
      <SchoolLogo slug={school.slug} size={40} className="shadow-1" />
      <div className="min-w-0 flex-1">
        {back ? (
          <nav aria-label="Breadcrumb" className="truncate text-headline font-semibold text-ink">
            <Link href="/ask" className="text-muted underline decoration-line-strong decoration-1 underline-offset-4 hover:text-ink">
              Home
            </Link>
            <span aria-hidden className="mx-1.5 text-muted">
              /
            </span>
            <span aria-current="page">Chat</span>
          </nav>
        ) : (
          <p className="truncate text-headline font-semibold text-ink">{school.name}</p>
        )}
        <p className="flex items-center gap-1.5 text-caption text-muted">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${school.openNow.open ? "pulse-dot bg-success" : "bg-[var(--ink-placeholder)]"}`} style={{ color: "var(--success)" }} />
          {back ? `${school.shortName} Front Desk` : "Front Desk"} · {school.openNow.label}
        </p>
      </div>
      <ThemeToggle className="-mr-2" />
      <Link href="/" aria-label="Switch perspective" className="grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink">
        <LogOut className="h-5 w-5" aria-hidden />
      </Link>
    </header>
  );
}
