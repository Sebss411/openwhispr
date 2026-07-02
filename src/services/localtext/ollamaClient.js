// Optional Ollama integration for the local text pipeline. Ollama is never
// required: a short cached probe checks if a local server is running, and any
// failure falls back to rule-based processing. No data leaves the machine —
// requests only ever target the local Ollama endpoint.

const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const PROBE_CACHE_MS = 30000;

let probeCache = { at: 0, ok: false, model: null, baseUrl: null };

function fetchWithTimeout(url, options = {}, timeoutMs = 500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// Returns { ok, model } — `model` is the first installed model, used unless
// the caller overrides it.
export async function probeOllama({ baseUrl = DEFAULT_BASE_URL, timeoutMs = 600 } = {}) {
  const now = Date.now();
  if (probeCache.baseUrl === baseUrl && now - probeCache.at < PROBE_CACHE_MS) {
    return probeCache;
  }
  try {
    const res = await fetchWithTimeout(`${baseUrl}/api/tags`, {}, timeoutMs);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const model = data?.models?.[0]?.name || null;
    probeCache = { at: now, ok: !!model, model, baseUrl };
  } catch {
    probeCache = { at: now, ok: false, model: null, baseUrl };
  }
  return probeCache;
}

const SYSTEM_PROMPT = [
  "You transform dictated text following one instruction.",
  "Never invent information. Never add facts, names or dates that are not in the text.",
  "Preserve the author's meaning, language and tone unless the instruction says otherwise.",
  "Return only the transformed text, with no preamble, quotes or explanations.",
].join(" ");

export async function ollamaTransform({
  instruction,
  text,
  model,
  baseUrl = DEFAULT_BASE_URL,
  timeoutMs = 30000,
}) {
  if (!instruction || !text || !model) return null;
  try {
    const res = await fetchWithTimeout(
      `${baseUrl}/api/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `${instruction}\n\n---\n${text}` },
          ],
        }),
      },
      timeoutMs
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const out = data?.message?.content?.trim();
    return out || null;
  } catch {
    return null;
  }
}
