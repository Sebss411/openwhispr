# Mobile Architecture Plan

Goal: a private, local-first mobile companion to the desktop app — record, transcribe, clean, share — without cloud, accounts, or subscriptions. Nothing here blocks or changes the desktop app.

> **Status update (July 2026)**: batches 4–6 are now implemented in-repo (uncommitted):
>
> - `packages/core/` — shared core (re-exports `src/services/localtext` + history/settings schemas)
> - `scripts/mobile-whisper-server.js` (`npm run serve:mobile`) — LAN transcription bridge reusing the desktop's whisper-server binary and models, with ffmpeg conversion and optional server-side cleanup (`?clean=1`). **Tested end-to-end on this machine.**
> - `apps/mobile/` — Expo MVP (record → bridge → shared cleanup → clipboard/share → SQLite history). Scaffold complete, not yet run on a device.
> - `apps/android-ime/` — Kotlin voice keyboard (dictate into any app via the bridge). Code complete, not yet compiled (no Android SDK on this machine).
>
> The sections below remain the reference design.

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

- **Android IME** (`InputMethodService`): fewer restrictions; implemented in `apps/android-ime/` against the LAN bridge (cleanup runs server-side via `?clean=1`, so no JS runtime on the phone). On-device whisper.cpp tiny/base in-process is the offline upgrade path.
- **iOS custom keyboard** (App Extension): see decision below.

## iOS keyboard — decision (batch 7): deferred

Assessment: **it does not pay off right now.** Reasons, in order of weight:

1. **No build environment**: requires macOS + Xcode + an Apple Developer setup; none available on this Windows machine, so anything written here would be unverifiable Swift.
2. **Personal-use friction**: without a paid developer account, sideloaded builds expire every 7 days; with one, it's $99/year — against the whole point of this project (zero recurring cost).
3. **Platform ceiling**: keyboard extensions get ~60–70 MB RAM (rules out on-device whisper beyond tiny), need "Allow Full Access" for network, and cannot record audio directly in many configurations — the standard workaround (hand off to the host app via App Group, come back for the text) is a materially worse UX than the Android IME.
4. **Coverage exists**: the Expo MVP runs on iOS via Expo Go — record → transcribe → auto-copy → paste covers ~80% of the keyboard use case on iOS today.

Revisit when: a Mac is available AND the Android IME has proven the bridge workflow day-to-day. The right shape then is a keyboard extension that POSTs to the same bridge (`?clean=1`), sharing `packages/core` schemas — roughly the iOS twin of `apps/android-ime`.

## Non-goals

- No cloud relay, no sync service, no accounts.
- No SaaS packaging.
- Desktop remains the priority; mobile work must not force desktop refactors beyond the workspace extraction above.
