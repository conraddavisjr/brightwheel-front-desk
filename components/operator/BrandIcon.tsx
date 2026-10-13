import Image from "next/image";

/** The real product logos for each integration, on a soft tile. */
const LOGOS: Record<string, { src: string; name: string }> = {
  notion: { src: "/brands/notion.svg", name: "Notion" },
  drive: { src: "/brands/google-drive.svg", name: "Google Drive" },
  calendar: { src: "/brands/google-calendar.svg", name: "Google Calendar" },
  ical: { src: "/brands/google-calendar.svg", name: "Google Calendar" },
};

export function brandName(kind: string): string | null {
  return LOGOS[kind]?.name ?? null;
}

export function BrandIcon({ kind, size = 40, bare = false }: { kind: string; size?: number; bare?: boolean }) {
  const logo = LOGOS[kind];
  const glyphSize = Math.round(size * (bare ? 1 : 0.58));
  const glyph = logo ? (
    <Image src={logo.src} alt="" width={glyphSize} height={glyphSize} unoptimized loading="eager" className="object-contain" style={{ width: glyphSize, height: glyphSize }} />
  ) : (
    <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" aria-hidden>
      <path d="M6 3h8l4 4v14H6z" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 3v4h4" stroke="var(--accent)" strokeWidth="1.6" fill="none" />
    </svg>
  );
  if (bare) return glyph;
  return (
    <span className={`grid shrink-0 place-items-center rounded-[12px] ${logo ? "bg-white ring-1 ring-line-soft" : "bg-accent-tint"}`} style={{ width: size, height: size }}>
      {glyph}
    </span>
  );
}
