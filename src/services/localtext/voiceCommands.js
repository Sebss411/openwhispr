// Local voice-command detection for dictation, no LLM required. Detects an
// instruction spoken at the start ("formato email: ...") or end ("... .
// Hazlo más corto") of a transcript, in Spanish or English. Each command has
// a deterministic rule fallback; commands that genuinely need generation
// (translate, summarize, professional rewrite) are marked `llmPreferred` and
// use a local LLM (Ollama) when one is reachable — never required.

function esOrEn(language, es, en) {
  return String(language || "").toLowerCase().startsWith("es") ? es : en;
}

export const VOICE_COMMANDS = [
  {
    id: "fixOnly",
    llmPreferred: false,
    patterns: [/^s[oó]lo corrige(?:lo)?$/iu, /^just (?:fix|clean)(?: it)?(?: up)?$/i, /^only fix$/i],
    instruction: () =>
      "Fix spelling, punctuation and obvious transcription errors only. Do not rephrase.",
  },
  {
    id: "keepTone",
    llmPreferred: false,
    patterns: [
      /^sin cambiar mi tono$/iu,
      /^(?:without changing|keep) my tone$/i,
      /^keep the tone$/i,
    ],
    instruction: () =>
      "Clean up the text minimally while strictly preserving the author's tone and wording.",
  },
  {
    id: "shorter",
    llmPreferred: true,
    patterns: [
      /^(?:hazlo|ponlo) m[aá]s corto$/iu,
      /^m[aá]s corto$/iu,
      /^ac[oó]rtalo$/iu,
      /^make (?:it|this) shorter$/i,
      /^shorten (?:it|this)$/i,
    ],
    instruction: () =>
      "Make this text shorter while keeping all key information, the original language and the author's tone. Do not add anything.",
  },
  {
    id: "professional",
    llmPreferred: true,
    patterns: [
      /^(?:hazlo|ponlo|que suene) m[aá]s profesional$/iu,
      /^m[aá]s profesional$/iu,
      /^make (?:it|this) more professional$/i,
      /^more professional$/i,
    ],
    instruction: () =>
      "Rewrite this text with a more professional tone, in the same language, without adding or removing information.",
  },
  {
    id: "email",
    llmPreferred: true,
    patterns: [
      /^formato (?:de )?(?:email|correo)$/iu,
      /^como (?:un )?(?:email|correo)$/iu,
      /^(?:format(?: this)? as|as) an? email$/i,
      /^email format$/i,
    ],
    instruction: () =>
      "Format this text as a short email in the same language: greeting, body, sign-off. Do not invent names or facts.",
  },
  {
    id: "tweet",
    llmPreferred: true,
    patterns: [
      /^formato (?:de )?tweet$/iu,
      /^como (?:un )?tweet$/iu,
      /^(?:format(?: this)? as|as) a tweet$/i,
      /^tweet format$/i,
    ],
    instruction: () =>
      "Rewrite this as a single tweet (max 280 characters), same language and tone, no hashtags unless present in the text.",
  },
  {
    id: "whatsapp",
    llmPreferred: true,
    patterns: [
      /^(?:formato|mensaje) (?:de )?whatsapp$/iu,
      /^como (?:un )?(?:mensaje de )?whatsapp$/iu,
      /^(?:as a )?whatsapp message$/i,
    ],
    instruction: () =>
      "Rewrite this as a casual chat message, same language, keeping the author's tone. Keep it brief.",
  },
  {
    id: "linkedin",
    llmPreferred: true,
    patterns: [
      /^(?:post|publicaci[oó]n) (?:de |para )?linkedin$/iu,
      /^formato linkedin$/iu,
      /^linkedin post$/i,
      /^(?:format(?: this)? as|as) a linkedin post$/i,
    ],
    instruction: () =>
      "Format this as a LinkedIn post in the same language: short paragraphs, clear opening line. Do not invent achievements or facts.",
  },
  {
    id: "keyPoints",
    llmPreferred: true,
    patterns: [
      /^(?:en )?puntos clave$/iu,
      /^en puntos$/iu,
      /^(?:key|bullet) points$/i,
      /^as bullets$/i,
    ],
    instruction: () =>
      "Convert this text into a concise bullet list of its key points, same language, no new information.",
  },
  {
    id: "summary",
    llmPreferred: true,
    patterns: [
      /^(?:hazme )?(?:un )?resumen$/iu,
      /^res[uú]melo$/iu,
      /^summar(?:ize|ise)(?: it| this)?$/i,
      /^(?:a )?summary$/i,
      /^tl;?dr$/i,
    ],
    instruction: () =>
      "Summarize this text briefly in the same language. Only use information present in the text.",
  },
  {
    id: "translateEn",
    llmPreferred: true,
    requiresLLM: true,
    patterns: [
      /^trad[uú]ce(?:lo)? al ingl[eé]s$/iu,
      /^en ingl[eé]s$/iu,
      /^translate (?:it |this )?(?:to|into) english$/i,
    ],
    instruction: () => "Translate this text to English. Preserve meaning and tone exactly.",
  },
];

const TRAILING_PUNCT_RE = /[\s.,;:!?…]+$/u;
const LEADING_SEP_RE = /^[,.:;-]\s*/u;

function matchCommand(candidate) {
  const normalized = candidate.replace(TRAILING_PUNCT_RE, "").trim();
  if (!normalized || normalized.length > 60) return null;
  for (const command of VOICE_COMMANDS) {
    if (command.patterns.some((re) => re.test(normalized))) return command;
  }
  return null;
}

// Looks for a command phrase as the leading segment ("hazlo más corto: texto…")
// or as the final segment after sentence punctuation ("texto… Formato email").
// Returns { command, body } or null.
export function detectVoiceCommand(text) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Leading segment: up to the first separator (,:.;) within the first 60 chars.
  const leadingSep = trimmed.slice(0, 61).match(/[,:.;]/u);
  if (leadingSep && leadingSep.index > 0) {
    const command = matchCommand(trimmed.slice(0, leadingSep.index));
    if (command) {
      const body = trimmed.slice(leadingSep.index).replace(LEADING_SEP_RE, "").trim();
      if (body) return { command, body };
    }
  }

  // Trailing segment: after the last sentence separator.
  const lastSep = Math.max(
    trimmed.lastIndexOf("."),
    trimmed.lastIndexOf("!"),
    trimmed.lastIndexOf("?"),
    trimmed.lastIndexOf(",")
  );
  if (lastSep > 0 && lastSep < trimmed.length - 1) {
    const command = matchCommand(trimmed.slice(lastSep + 1));
    if (command) {
      const body = trimmed.slice(0, lastSep + 1).replace(TRAILING_PUNCT_RE, "").trim();
      if (body) return { command, body };
    }
  }

  return null;
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?…])\s+/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

function trimToLength(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max - 1).replace(TRAILING_PUNCT_RE, "")}…`;
}

// Deterministic, offline fallbacks. They only reformat — never generate — so
// commands that need real generation return `needsLLM: true` with the cleaned
// text unchanged.
export function applyCommandRules(commandId, text, language = "auto") {
  switch (commandId) {
    case "fixOnly":
    case "keepTone":
    case "whatsapp":
      return { text };
    case "tweet":
      return { text: trimToLength(text, 280) };
    case "keyPoints":
      return { text: splitSentences(text).map((s) => `- ${s.replace(/[.]$/u, "")}`).join("\n") };
    case "linkedin": {
      const sentences = splitSentences(text);
      const paragraphs = [];
      for (let i = 0; i < sentences.length; i += 2) {
        paragraphs.push(sentences.slice(i, i + 2).join(" "));
      }
      return { text: paragraphs.join("\n\n") };
    }
    case "email": {
      const greeting = esOrEn(language, "Hola,", "Hi,");
      const signoff = esOrEn(language, "Un saludo", "Best regards");
      return { text: `${greeting}\n\n${text}\n\n${signoff}` };
    }
    case "shorter":
    case "professional":
    case "summary":
      // Rules can't do this faithfully; cleaned text is the honest fallback.
      return { text, needsLLM: true };
    case "translateEn":
      return { text, needsLLM: true };
    default:
      return { text };
  }
}
