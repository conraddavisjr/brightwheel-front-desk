/** Simple, original glyphs for each integration (not the vendors' logo files). */
export function BrandIcon({ kind, size = 40 }: { kind: string; size?: number }) {
  const common = { width: size * 0.55, height: size * 0.55, viewBox: "0 0 24 24", "aria-hidden": true } as const;
  const wrap = (bg: string, child: React.ReactNode) => (
    <span className={`grid shrink-0 place-items-center rounded-[12px] ${bg}`} style={{ width: size, height: size }}>
      {child}
    </span>
  );
  switch (kind) {
    case "notion":
      return wrap("bg-[#f6f5f4] ring-1 ring-[#e6e4e1]", <svg {...common}><rect x="4" y="3" width="16" height="18" rx="2.5" fill="#fff" stroke="#191919" strokeWidth="1.6" /><path d="M9 8v8M9 8l6 8M15 8v8" stroke="#191919" strokeWidth="1.6" strokeLinecap="round" /></svg>);
    case "drive":
      return wrap("bg-[#f1f8f3] ring-1 ring-[#dcefe2]", <svg {...common}><path d="M8.5 3h7l6 10.5-3.5 6h-12L2.5 13.5z" fill="none" stroke="#1e8e3e" strokeWidth="1.4" strokeLinejoin="round" /><path d="M8.5 3l6 10.5h7M15.5 3l-6 10.5L6 19.5M2.5 13.5h12l3.5 6" stroke="#4285f4" strokeWidth="1.4" fill="none" strokeLinejoin="round" /></svg>);
    case "calendar":
    case "ical":
      return wrap("bg-[#eef4fe] ring-1 ring-[#dbe7fc]", <svg {...common}><rect x="3.5" y="5" width="17" height="15" rx="3" fill="#fff" stroke="#1a73e8" strokeWidth="1.6" /><path d="M3.5 9.5h17M8 3v4M16 3v4" stroke="#1a73e8" strokeWidth="1.6" strokeLinecap="round" /><text x="12" y="17.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="#1a73e8">31</text></svg>);
    case "slack":
      return wrap("bg-[#f8f1f8] ring-1 ring-[#efdef0]", <svg {...common}><rect x="10" y="2.5" width="4" height="9" rx="2" fill="#36c5f0" /><rect x="12.5" y="10" width="9" height="4" rx="2" fill="#2eb67d" /><rect x="10" y="12.5" width="4" height="9" rx="2" fill="#ecb22e" /><rect x="2.5" y="10" width="9" height="4" rx="2" fill="#e01e5a" /></svg>);
    default:
      return wrap("bg-accent-tint", <svg {...common}><path d="M6 3h8l4 4v14H6z" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinejoin="round" /><path d="M14 3v4h4" stroke="var(--accent)" strokeWidth="1.6" fill="none" /></svg>);
  }
}
