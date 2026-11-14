/**
 * Text helpers for the PDF: the standard fonts only know the Windows-1252
 * characters, so anything else is swapped for a close equivalent before it is
 * measured or drawn.
 */

const REPLACEMENTS: readonly (readonly [RegExp, string])[] = [
  // No-break, narrow no-break, thin and figure spaces.
  [/[    ]/g, " "],
  [/−/g, "-"],
  [/≥/g, ">="],
  [/≤/g, "<="],
  [/→/g, "->"],
  [/≈/g, "~"],
];

/** Rewrites `text` with only characters the font can draw. Unknown ones become "?". */
export function drawable(text: string, supported: ReadonlySet<number>): string {
  const swapped = REPLACEMENTS.reduce((current, [pattern, value]) => current.replace(pattern, value), text);
  return Array.from(swapped.replace(/\s+/g, " "))
    .map((char) => (supported.has(char.codePointAt(0) ?? 0) ? char : "?"))
    .join("")
    .trim();
}

/**
 * Breaks a text into lines no wider than `maxWidth`. A single word wider than
 * the line is cut, so nothing is ever drawn outside the page.
 */
export function wrap(text: string, maxWidth: number, widthOf: (text: string) => number): string[] {
  const lines: string[] = [];
  let line = "";

  const push = (word: string) => {
    let rest = word;
    while (widthOf(rest) > maxWidth && rest.length > 1) {
      let cut = rest.length - 1;
      while (cut > 1 && widthOf(rest.slice(0, cut)) > maxWidth) cut -= 1;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    line = rest;
  };

  for (const word of text.split(" ").filter((part) => part !== "")) {
    const candidate = line === "" ? word : `${line} ${word}`;
    if (widthOf(candidate) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line !== "") lines.push(line);
    push(word);
  }
  if (line !== "") lines.push(line);
  return lines;
}
