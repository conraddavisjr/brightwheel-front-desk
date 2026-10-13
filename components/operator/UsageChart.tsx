"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Daily questions, stacked: answered by Front Desk vs needed staff.
 * Hand-rolled SVG (no chart library on the critical path): 2px surface gaps
 * between segments, 4px rounded data-ends, hairline grid, a per-column hover
 * tooltip, a legend, and a table view for screen readers and exact values.
 */
export interface Day {
  day: string;
  answered: number;
  other: number;
}

const H = 180;
const PAD = { top: 12, right: 8, bottom: 26, left: 30 };

function niceMax(v: number): number {
  if (v <= 5) return 5;
  const step = Math.pow(10, Math.floor(Math.log10(v)));
  const n = Math.ceil(v / step);
  return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * step;
}

const fmtDay = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", opts);

export function UsageChart({ data }: { data: Day[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = niceMax(Math.max(1, ...data.map((d) => d.answered + d.other)));
  const innerW = w - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const band = innerW / data.length;
  const barW = Math.min(18, Math.max(4, band - 4));
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];
  const peak = data.reduce((best, d, i) => (d.answered + d.other > data[best].answered + data[best].other ? i : best), 0);

  // A column path: square at the baseline, 4px rounded top.
  const col = (x: number, top: number, bottom: number, round: boolean) => {
    const h = Math.max(0, bottom - top);
    if (h <= 0) return "";
    const r = round ? Math.min(4, h, barW / 2) : 0;
    return `M${x},${bottom} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${bottom} Z`;
  };

  const h = hover !== null ? data[hover] : null;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1.5 text-caption font-medium text-muted">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: "var(--chart-1)" }} /> Answered by Front Desk
        </span>
        <span className="inline-flex items-center gap-1.5 text-caption font-medium text-muted">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: "var(--chart-2)" }} /> Needed staff
        </span>
        <button type="button" onClick={() => setTable((t) => !t)} className="ml-auto min-h-9 rounded-full px-2.5 text-caption font-semibold text-accent hover:bg-accent-tint">
          {table ? "Show chart" : "View as table"}
        </button>
      </div>
      {table ? (
        <div className="mt-2 max-h-[220px] overflow-auto rounded-[12px] ring-1 ring-line-soft">
          <table className="w-full text-left text-caption">
            <thead className="sticky top-0 bg-sunken text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Day</th>
                <th className="px-3 py-2 text-right font-semibold">Answered</th>
                <th className="px-3 py-2 text-right font-semibold">Needed staff</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {data.map((d) => (
                <tr key={d.day} className="border-t border-line-soft">
                  <td className="px-3 py-1.5 text-ink">{fmtDay(d.day, { weekday: "short", month: "short", day: "numeric" })}</td>
                  <td className="px-3 py-1.5 text-right text-ink">{d.answered}</td>
                  <td className="px-3 py-1.5 text-right text-ink">{d.other}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="relative mt-2" onMouseLeave={() => setHover(null)}>
          <svg width={w} height={H} role="img" aria-label={`Questions per day over the last ${data.length} days. Peak ${data[peak].answered + data[peak].other} on ${fmtDay(data[peak].day, { month: "long", day: "numeric" })}.`} className="block">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth={1} />
                <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="fill-[var(--ink-muted)] text-[11px] tabular">
                  {t}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const x = PAD.left + i * band + (band - barW) / 2;
              const base = y(0);
              const aTop = y(d.answered);
              const total = d.answered + d.other;
              const oTop = y(total);
              const dim = hover !== null && hover !== i;
              return (
                <g key={d.day} opacity={dim ? 0.45 : 1} style={{ transition: "opacity 160ms" }}>
                  <path d={col(x, aTop, base, d.other === 0)} fill="var(--chart-1)" />
                  {d.other > 0 ? <path d={col(x, oTop, aTop - 2, true)} fill="var(--chart-2)" /> : null}
                  <rect className="chart-hit" x={PAD.left + i * band} y={PAD.top} width={band} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={-1} />
                </g>
              );
            })}
            {data.map((d, i) =>
              i % 7 === (data.length - 1) % 7 ? (
                <text key={`x-${d.day}`} x={PAD.left + i * band + band / 2} y={H - 8} textAnchor="middle" className="fill-[var(--ink-muted)] text-[11px]">
                  {fmtDay(d.day, { month: "short", day: "numeric" })}
                </text>
              ) : null,
            )}
            <text x={PAD.left + peak * band + band / 2} y={y(data[peak].answered + data[peak].other) - 6} textAnchor="middle" className="fill-[var(--ink)] text-[11px] font-semibold tabular">
              {data[peak].answered + data[peak].other}
            </text>
          </svg>
          {h && hover !== null ? (
            <div
              role="status"
              className="pointer-events-none absolute top-0 z-10 w-44 -translate-x-1/2 rounded-[12px] bg-raised p-2.5 text-caption shadow-3 ring-1 ring-line-soft"
              style={{ left: Math.min(Math.max(PAD.left + hover * band + band / 2, 88), w - 88) }}
            >
              <p className="font-semibold text-ink">{fmtDay(h.day, { weekday: "long", month: "short", day: "numeric" })}</p>
              <p className="mt-1 flex items-center justify-between text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-[2px]" style={{ background: "var(--chart-1)" }} /> Answered
                </span>
                <span className="tabular font-semibold text-ink">{h.answered}</span>
              </p>
              <p className="flex items-center justify-between text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-[2px]" style={{ background: "var(--chart-2)" }} /> Needed staff
                </span>
                <span className="tabular font-semibold text-ink">{h.other}</span>
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
