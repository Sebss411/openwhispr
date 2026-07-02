// Rule-based transcript cleanup that runs fully offline — no LLM, no API.
// Used when no cleanup model is configured (or reasoning fails), so dictation
// still produces tidy text instead of a raw transcript. Deliberately
// conservative: it removes noise (hesitations, stutters, spacing) and fixes
// mechanical punctuation, but never rephrases, so meaning and tone are
// preserved. Supports Spanish and English.

import { applyReplacements } from "./personalDictionary.js";

// Hesitation tokens that are (near-)always noise, standalone only.
const STANDALONE_FILLERS = [
  "uh",
  "uhh",
  "um",
  "umm",
  "uhm",
  "erm",
  "hmm",
  "hm",
  "mmm",
  "mm",
  "eh",
  "ehh",
  "ehm",
  "em",
  "ah",
  "ahh",
];

// Phrase fillers removed only when set off by punctuation (", you know," /
// start-of-text + comma), so legitimate uses inside a sentence survive.
const PHRASE_FILLERS = [
  // English
  "you know",
  "i mean",
  // Spanish
  "o sea",
  "¿sabes?",
  "sabes?",
  "¿vale?",
  "vale?",
  "¿no?",
  "pues nada",
];

const STANDALONE_FILLER_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${STANDALONE_FILLERS.join("|")})(?![\\p{L}\\p{N}])`,
  "giu"
);

const PHRASE_FILLER_RES = PHRASE_FILLERS.map((phrase) => {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Only match when delimited by start/end of text or punctuation on both sides.
  return new RegExp(`(?:^|[,;.!?]\\s*)${escaped}(?=\\s*(?:[,;.!?]|$))`, "giu");
});

export function removeFillers(text) {
  let out = text.replace(STANDALONE_FILLER_RE, "");
  for (const re of PHRASE_FILLER_RES) {
    out = out.replace(re, (match) => {
      // Keep the leading punctuation that anchored the match, drop the phrase.
      const punct = match.match(/^[,;.!?]/);
      return punct ? punct[0] : "";
    });
  }
  return out;
}

// Collapse dictation stutters: immediate repeats of the same word ("the the",
// "que que") and of the same bigram ("I think I think"). Case-insensitive,
// keeps the first occurrence.
export function collapseRepetitions(text) {
  let out = text.replace(/(?<![\p{L}\p{N}])([\p{L}]+)(?:\s+\1)+(?![\p{L}\p{N}])/giu, "$1");
  out = out.replace(/(?<![\p{L}\p{N}])([\p{L}]+\s+[\p{L}]+)(?:\s+\1)+(?![\p{L}\p{N}])/giu, "$1");
  return out;
}

export function normalizeSpacing(text) {
  return (
    text
      // collapse runs of spaces/tabs but keep intentional newlines
      .replace(/[^\S\n]+/g, " ")
      // no space before closing punctuation
      .replace(/ +([,;:.!?)\]}])/g, "$1")
      // no space after opening marks
      .replace(/([¿¡([{]) +/g, "$1")
      // stray comma runs left behind by filler removal
      .replace(/([,;])\s*(?:[,;]\s*)+/g, "$1 ")
      .replace(/([,;])\s*([.!?])/g, "$2")
      // leading orphan punctuation
      .replace(/^\s*[,;.]+\s*/g, "")
      // single space after sentence punctuation when a word follows
      .replace(/([,;:.!?])(?=[\p{L}¿¡])/gu, "$1 ")
      .replace(/ {2,}/g, " ")
      .trim()
  );
}

const SENTENCE_END_RE = /[.!?…]["')\]]?\s+/;

export function fixBasicPunctuation(text, language = "auto") {
  let out = text;

  // Capitalize the first letter of the text and after sentence-ending punctuation.
  out = out.replace(/(^|[.!?…]["')\]]?\s+)(\p{Ll})/gu, (m, prefix, letter) => {
    return prefix + letter.toLocaleUpperCase(language === "auto" ? undefined : language);
  });

  // Add a terminal period for sentence-style dictation only, so short inline
  // fragments ("mañana a las 10") aren't force-terminated. Sentence-style =
  // at least 6 words, or any internal punctuation already present.
  const endsInWord = /[\p{L}\p{N}]$/u.test(out);
  const wordCount = (out.match(/[\p{L}\p{N}]+/gu) || []).length;
  const looksLikeSentences = SENTENCE_END_RE.test(out) || /[,;:.!?…]/.test(out) || wordCount >= 6;
  if (endsInWord && looksLikeSentences) {
    out = `${out}.`;
  }

  return out;
}

// Full cleanup pipeline. `replacements` come from the personal dictionary
// ("misheard => correct" entries).
export function cleanupTranscript(text, { language = "auto", replacements = [] } = {}) {
  if (typeof text !== "string" || !text.trim()) return "";
  let out = text;
  out = applyReplacements(out, replacements);
  out = removeFillers(out);
  out = collapseRepetitions(out);
  out = normalizeSpacing(out);
  out = fixBasicPunctuation(out, language);
  return out;
}
