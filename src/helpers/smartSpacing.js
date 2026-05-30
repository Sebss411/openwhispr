// Inserts a space around transcribed text so dictation flows naturally with
// already-typed content. Pure function — no I/O, no platform calls.
//
// Two modes:
//   - "prepend": caller knows the character before the cursor (macOS only,
//     read via Accessibility API). Apply contextual rules.
//   - "append": caller has no cursor context (Windows/Linux, or macOS fallback
//     when the AX read fails). Add a trailing space so the next paste / typed
//     character lands with a separator already in place.

const OPENING_CHARS = new Set([" ", "\t", "\n", "\r", "(", "[", "{", "<", '"', "'", "`", "“", "‘"]);
const LEADING_PUNCTUATION = new Set([",", ".", "!", "?", ";", ":", ")", "]", "}", "%", "”", "’"]);
const TRAILING_WHITESPACE_RE = /\s$/;
const LEADING_WHITESPACE_RE = /^\s/;

/**
 * @typedef {Object} SmartSpacingInput
 * @property {string} text - the transcribed text about to be pasted
 * @property {"prepend"|"append"} mode
 * @property {string} [precedingChar] - char immediately before the cursor.
 *   Required for mode="prepend". Pass "" to indicate the cursor is at field start.
 */

/**
 * @param {SmartSpacingInput} input
 * @returns {string} text with a leading or trailing space added per the rules,
 *   or unchanged if no space is needed.
 */
function applySmartSpacing({ text, mode, precedingChar }) {
  if (typeof text !== "string" || text.length === 0) return text;

  if (mode === "prepend") {
    return applyPrepend(text, precedingChar);
  }

  if (mode === "append") {
    return applyAppend(text);
  }

  return text;
}

function applyPrepend(text, precedingChar) {
  // Cursor at field start (or empty field) → no leading space.
  if (precedingChar === "" || precedingChar == null) return text;

  // Already starts with whitespace → don't double up.
  if (LEADING_WHITESPACE_RE.test(text)) return text;

  // Preceding char is a "natural separator" (whitespace, open bracket, quote).
  if (OPENING_CHARS.has(precedingChar)) return text;

  // Transcript starts with closing punctuation — never want a space between
  // existing text and the punctuation ("Hello" + ", world" → "Hello, world").
  if (LEADING_PUNCTUATION.has(text[0])) return text;

  return " " + text;
}

function applyAppend(text) {
  if (TRAILING_WHITESPACE_RE.test(text)) return text;
  return text + " ";
}

module.exports = { applySmartSpacing };
