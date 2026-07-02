# Mobile Architecture Plan

Goal: a private, local-first mobile companion to the desktop app — record, transcribe, clean, share — without cloud, accounts, or subscriptions. This is a plan; nothing here blocks or changes the desktop app.

## What is already shareable today

| Piece | Where | Status |
| --- | --- | --- |
| Text cleanup rules (es/en) | `src/services/localtext/localCleanup.js` | Pure ESM, zero deps — portable as-is |
| Voice command detector + rule transforms | `src/services/localtext/voiceCommands.js` | Pure ESM — portable as-is |
| Personal dictionary parsing | `src/services/localtext/personalDictionary.js` | Pure ESM — portable as-is |
| Ollama client | `src/services/localtext/ollamaClient.js` | Needs only `fetch` — portable |
| History schema | `CREATE TABLE transcriptions (…)` in `src/helpers/database.js` | Copyable SQL; same schema works in expo-sqlite |
| Settings shape | keys documented in CLAUDE.md §5 | Mirror as a JSON schema when mobile starts |
| Model registry | `src/models/modelRegistryData.json` | Plain JSON — shareable (whisper model names/URLs) |

The `localtext` modules were deliberately written dependency-free so this table stays true.

## Proposed structure (when mobile work starts)

Convert the repo to npm workspaces **without moving desktop code first** — extract only when mobile actually consumes it:

```
packages/
  core/            # extracted from src/services/localtext + shared schemas
    src/cleanup/   # localCleanup, voiceCommands, personalDictionary, ollamaClient
    src/schema/    # transcriptions table DDL, settings JSON schema
apps/
  mobile/          # Expo (React Native) app
(desktop stays at repo root until a later, separate refactor)
```

Desktop imports switch from `../services/localtext/` to `@openwhispr/core` in one mechanical pass. Do not restructure preemptively.

## Mobile MVP (batch 5)

Expo (React Native) app, offline-first:

1. **Record**: `expo-av` mic capture → WAV/M4A.
2. **Transcribe**, two modes:
   - **On-device**: `whisper.rn` (whisper.cpp bindings for RN; Metal on iOS, CPU on Android). tiny/base models are practical on phones; reuse download URLs from `modelRegistryData.json`.
   - **LAN**: POST audio to the desktop's `whisper-server` — the desktop app already runs one and the codebase already supports remote whisper-server (`remoteTranscriptionType: "lan"`). Zero new desktop work; phone stays offline-capable when home.
3. **Clean**: `@openwhispr/core` cleanup + voice commands (identical behavior to desktop).
4. **Output**: copy to clipboard + native share sheet.
5. **History**: expo-sqlite with the shared `transcriptions` schema.

No accounts, no push, no analytics. Estimated scope: small — the hard parts (cleanup, commands, schema) are already written and tested.

## Mobile advanced (batch 6)

- **iOS custom keyboard** (App Extension): keyboards have a ~60–70 MB memory ceiling — only tiny (~75 MB mmap'd, borderline) fits; the pragmatic pattern is the keyboard records and hands off to the main app via App Group, or hits the LAN whisper-server. Requires "Allow Full Access" for network/mic.
- **Android IME** (`InputMethodService`): fewer restrictions; can run whisper.cpp tiny/base in-process and type results directly into any app. This is the closest to desktop "dictate anywhere" and should come first.
- Both reuse `@openwhispr/core` via a JS runtime (Hermes) or a thin native port of the cleanup rules if running outside RN.

## Non-goals

- No cloud relay, no sync service, no accounts.
- No SaaS packaging.
- Desktop remains the priority; mobile work must not force desktop refactors beyond the workspace extraction above.
