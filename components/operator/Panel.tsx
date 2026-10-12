import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-display">{title}</h1>
        {subtitle ? <p className="mt-1 text-dense text-muted sm:text-body">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Panel({ title, subtitle, action, children, className = "" }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[16px] bg-surface p-4 shadow-1 ring-1 ring-line-soft sm:p-5 ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-headline font-semibold text-ink">{title}</h2>
          {subtitle ? <p className="text-caption text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
