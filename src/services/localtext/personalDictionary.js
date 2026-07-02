// Personal dictionary parsing. Plain entries ("Qdrant", "Sebss") act as
// transcription hints passed to Whisper. Correction entries written as
// "misheard => correct" (or "misheard -> correct") additionally rewrite the
// transcript after transcription, so recurring mis-hearings of names, brands,
// or jargon get fixed deterministically without any model.

const CORRECTION_SEPARATOR = /\s*(?:=>|->)\s*/;

export function parseDictionaryEntries(entries = []) {
  const hintWords = [];
  const replacements = [];
  for (const raw of Array.isArray(entries) ? entries : []) {
    if (typeof raw !== "string") continue;
    const entry = raw.trim();
    if (!entry) continue;
    const parts = entry.split(CORRECTION_SEPARATOR);
    if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
      const from = parts[0].trim();
      const to = parts[1].trim();
      replacements.push({ from, to });
      hintWords.push(to);
    } else {
      hintWords.push(entry);
    }
  }
  return { hintWords, replacements };
}

const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

// Whole-word, case-insensitive replacement. Unicode-aware boundaries so
// accented words ("más", "Müller") match correctly.
export function applyReplacements(text, replacements = []) {
  let out = text;
  for (const { from, to } of replacements) {
    if (!from || typeof to !== "string") continue;
    const escaped = from.replace(REGEX_SPECIALS, "\\$&");
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu");
    out = out.replace(pattern, to);
  }
  return out;
}
