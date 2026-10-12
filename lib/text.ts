/** "Harbor Kids" -> "Harbor Kids'", "Sunflower Valley" -> "Sunflower Valley's". */
export const possessive = (name: string) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);

/** Markdown to plain text for short excerpts (no **, #, table pipes or list dashes). */
export const plain = (md: string) =>
  md
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/[*_`#>]/g, "")
    .replace(/\s*\|\s*/g, " · ")
    .replace(/(^|\n)\s*[-+]\s+/g, "$1")
    .replace(/\s*·\s*(-{2,}\s*·\s*)+/g, " · ")
    .replace(/\s+/g, " ")
    .replace(/^\s*·\s*|\s*·\s*$/g, "")
    .trim();
