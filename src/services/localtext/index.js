// Local text pipeline: dictionary corrections + rule-based cleanup + voice
// commands, all offline. This is the zero-cost fallback path used when no
// cleanup LLM is configured. If a local Ollama server happens to be running
// it is used for generation-type commands (translate, summarize, …); it is
// optional and any failure silently falls back to rules.

import { parseDictionaryEntries } from "./personalDictionary.js";
import { cleanupTranscript } from "./localCleanup.js";
import { detectVoiceCommand, applyCommandRules } from "./voiceCommands.js";
import { probeOllama, ollamaTransform } from "./ollamaClient.js";

export { parseDictionaryEntries } from "./personalDictionary.js";
export { cleanupTranscript } from "./localCleanup.js";
export { detectVoiceCommand, applyCommandRules, VOICE_COMMANDS } from "./voiceCommands.js";
export { probeOllama, ollamaTransform } from "./ollamaClient.js";

export async function processTranscriptLocally(
  rawText,
  { language = "auto", dictionaryEntries = [], enableCommands = true, allowOllama = true, ollamaModel } = {}
) {
  const { replacements } = parseDictionaryEntries(dictionaryEntries);
  const match = enableCommands ? detectVoiceCommand(rawText) : null;
  const body = match ? match.body : rawText;
  const cleaned = cleanupTranscript(body, { language, replacements });

  if (!match) {
    return { text: cleaned, command: null, usedOllama: false };
  }

  const { command } = match;
  if (allowOllama && command.llmPreferred) {
    const probe = await probeOllama();
    if (probe.ok) {
      const out = await ollamaTransform({
        instruction: command.instruction(language),
        text: cleaned,
        model: ollamaModel || probe.model,
      });
      if (out) return { text: out, command: command.id, usedOllama: true };
    }
  }

  const ruled = applyCommandRules(command.id, cleaned, language);
  return {
    text: ruled.text,
    command: command.id,
    usedOllama: false,
    needsLLM: ruled.needsLLM === true,
  };
}
