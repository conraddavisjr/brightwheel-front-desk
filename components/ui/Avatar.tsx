/** Initials on a soft tint of the person's hue. */
export function Avatar({ name, hue = 230, size = 36, className = "" }: { name: string; hue?: number; size?: number; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, size < 30 ? 1 : 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center rounded-full font-semibold ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        background: `hsl(${hue} 85% 94%)`,
        color: `hsl(${hue} 55% 32%)`,
      }}
    >
      {initials}
    </span>
  );
}
