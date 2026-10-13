import Image from "next/image";
import { SCHOOL_LOGOS } from "@/lib/demo/people";
import { WheelMark } from "@/components/brand/WheelMark";

/** The school's own logo; schools without one show the brightwheel wheel. */
export function SchoolLogo({ slug, size = 32, fill = false, className = "" }: { slug: string; size?: number; fill?: boolean; className?: string }) {
  const src = SCHOOL_LOGOS[slug];
  if (!src) return <WheelMark size={size} className={className} />;
  // fill: take the parent's box (e.g. as tall as a heading block).
  return <Image src={src} alt="" width={size} height={size} unoptimized loading="eager" className={`shrink-0 rounded-[24%] ${fill ? "h-full w-full" : ""} ${className}`} style={fill ? undefined : { width: size, height: size }} />;
}
