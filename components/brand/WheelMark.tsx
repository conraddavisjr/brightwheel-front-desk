/**
 * An original wheel mark in brightwheel's palette (eight petals around a hub).
 * Drawn here rather than copied, so the prototype never ships their logo file.
 */
const PETALS = ["#5463D6", "#29B9BB", "#FC47AD", "#FF543E", "#FBA32A", "#FECC38", "#4FA06A", "#7E42EB"];

export function WheelMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={className}>
      {PETALS.map((c, i) => (
        <ellipse key={c} cx="16" cy="8.4" rx="4.2" ry="6.6" fill={c} opacity="0.92" transform={`rotate(${i * 45} 16 16)`} />
      ))}
      <circle cx="16" cy="16" r="4.6" fill="white" />
      <circle cx="16" cy="16" r="2.4" fill="#5463D6" />
    </svg>
  );
}

export function Wordmark({ product = "Front Desk", size = 28 }: { product?: string | null; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <WheelMark size={size} />
      <span className="text-[19px] font-bold tracking-[-0.02em] text-ink">brightwheel</span>
      {product ? (
        <span className="rounded-full bg-accent-tint px-2.5 py-0.5 text-label font-semibold text-accent">{product}</span>
      ) : null}
    </span>
  );
}
