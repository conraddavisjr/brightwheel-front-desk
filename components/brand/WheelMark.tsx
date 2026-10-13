/**
 * brightwheel's real logo (from mybrightwheel.com), split into the wheel and the
 * wordmark so the wheel keeps its colors and the wordmark follows the theme's ink.
 * Path data in logoPaths.ts.
 */
import { PETALS, WORDMARK } from "@/components/brand/logoPaths";

const WHEEL_BOX = "-0.5 329.95 123.5 123.5";
const LOGO_BOX = { x: 0, y: 332, w: 800, h: 136 };

export function WheelMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox={WHEEL_BOX} aria-hidden="true" className={className}>
      {PETALS.map((p) => (
        <path key={p.fill} d={p.d} fill={p.fill} />
      ))}
    </svg>
  );
}

/** The full brightwheel logo, optionally followed by a product pill. `size` is the logo height. */
export function Wordmark({ product = "Front Desk", size = 24 }: { product?: string | null; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg height={size} width={(size * LOGO_BOX.w) / LOGO_BOX.h} viewBox={`${LOGO_BOX.x} ${LOGO_BOX.y} ${LOGO_BOX.w} ${LOGO_BOX.h}`} role="img" aria-label="brightwheel" className="shrink-0 text-ink">
        {PETALS.map((p) => (
          <path key={p.fill} d={p.d} fill={p.fill} />
        ))}
        <path d={WORDMARK} fill="currentColor" />
      </svg>
      {product ? <span className="whitespace-nowrap rounded-full bg-accent-tint px-2.5 py-0.5 text-label font-semibold text-accent">{product}</span> : null}
    </span>
  );
}
