"use client";

import { CalendarPlus, MapPin, Clock3, Download } from "lucide-react";
import { formatEventWhen, googleCalendarUrl, icsFile, type CalEvent } from "@/lib/client/calendar";

const TINTS = [
  "bg-teal-tint text-teal-ink",
  "bg-pink-tint text-pink-ink",
  "bg-accent-tint text-accent",
  "bg-orange-tint text-orange-ink",
];

export function EventCard({ event, schoolName, index = 0 }: { event: CalEvent; schoolName: string; index?: number }) {
  const when = formatEventWhen(event);
  const closed = /\bclosed\b/i.test(event.title);
  const title = event.title.replace(/^CLOSED\s*[-:]\s*/i, "");

  function downloadIcs() {
    const blob = new Blob([icsFile(event, schoolName)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^\w]+/g, "-").toLowerCase()}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="rise-in rounded-[16px] bg-surface p-3.5 ring-1 ring-line-soft" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="flex gap-3.5">
        <div className={`grid h-[60px] w-[56px] shrink-0 place-content-center rounded-[14px] text-center leading-none ${closed ? "bg-sunken text-muted" : TINTS[index % TINTS.length]}`}>
          <span className="text-[11px] font-bold uppercase tracking-wide">{when.month}</span>
          <span className="mt-1 text-[24px] font-bold tabular">{when.day}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-headline font-semibold text-ink">
            {closed ? <span className="mr-1.5 rounded-full bg-sunken px-2 py-0.5 align-middle text-caption font-semibold text-muted">Closed</span> : null}
            {title}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-dense text-muted">
            <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {when.weekday} · {when.time}
          </p>
          {event.location ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-dense text-muted">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{event.location}</span>
            </p>
          ) : null}
        </div>
      </div>
      {event.description ? <p className="mt-2.5 line-clamp-3 text-dense text-muted">{event.description}</p> : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <a
          href={googleCalendarUrl(event, schoolName)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent px-3 text-label font-semibold text-on-accent transition-colors hover:bg-accent-hover active:scale-[0.98]"
        >
          <CalendarPlus className="h-4 w-4" aria-hidden />
          Google Calendar
        </a>
        <button
          type="button"
          onClick={downloadIcs}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent-tint px-3 text-label font-semibold text-accent transition-colors hover:bg-[var(--focus-halo)] active:scale-[0.98]"
        >
          <Download className="h-4 w-4" aria-hidden />
          Apple / Outlook
        </button>
      </div>
    </div>
  );
}
