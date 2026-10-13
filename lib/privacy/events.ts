import { detect, mask, STAFF_ONLY_TITLE, type DetectContext } from "@/lib/privacy/detect";

/**
 * Calendar events get the same Privacy Guard check as documents before
 * families can see them. A sensitive title makes the whole event staff-only;
 * a sensitive detail in the description or location is withheld.
 */
export function screenEvent<T extends { title: string; description: string | null; location: string | null }>(
  e: T,
  ctx: DetectContext = {},
): T & { staffOnly: boolean; held: number } {
  const clean = (text: string | null) => {
    if (!text) return { text, held: 0 };
    const found = detect(text, ctx);
    return { text: found.length ? mask(text, found) : text, held: found.length };
  };
  const title = detect(e.title, ctx);
  const description = clean(e.description);
  const location = clean(e.location);
  return { ...e, description: description.text, location: location.text, staffOnly: title.length > 0 || STAFF_ONLY_TITLE.test(e.title), held: title.length + description.held + location.held };
}
