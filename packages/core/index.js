// @openwhispr/core — shared, platform-agnostic core.
//
// The canonical implementation lives in `src/services/localtext/` (pure ESM,
// zero Electron/DOM deps) so the desktop app keeps importing it directly and
// Vite never has to reach outside its root. This package re-exports it for
// in-repo consumers (the Expo app resolves it via a Metro alias — see
// apps/mobile/metro.config.js). If the core is ever published or the repo
// converts to npm workspaces, move the modules here and flip the desktop
// imports — one mechanical pass, documented in docs/mobile-architecture.md.

export {
  processTranscriptLocally,
  parseDictionaryEntries,
  cleanupTranscript,
  detectVoiceCommand,
  applyCommandRules,
  VOICE_COMMANDS,
  probeOllama,
  ollamaTransform,
} from "../../src/services/localtext/index.js";
