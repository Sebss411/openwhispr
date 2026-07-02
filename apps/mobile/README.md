# OpenWhispr Mobile (MVP)

Private mobile dictation companion: record on your phone, transcribe **on your own computer** over your home network, clean up with the same offline rules as desktop, copy/share, local history. No cloud, no account.

> Status: scaffold written and code-reviewed, not yet run on a device — see "First run" below. The desktop bridge it depends on **is** tested end-to-end.

## How it works

```
phone (Expo app)                    your computer (repo root)
  record m4a  ──HTTP POST──▶  scripts/mobile-whisper-server.js  ──▶ ffmpeg ──▶ whisper-server
  cleanup (shared core)  ◀──────────────  { text }
  copy / share / history
```

Transcription quality/speed = your desktop's, not the phone's. Audio only ever travels phone → your PC on your LAN.

## First run

1. **On the computer** (repo root): `npm run setup:local` (once), then
   `npm run serve:mobile` — note the `phone URL: http://192.168.x.x:8380` line.
   Optional: `npm run serve:mobile -- --token mysecret --model small`.
   Allow node through the Windows firewall when prompted (private networks).
2. **In `apps/mobile/`**: `npm install`, then `npx expo install --fix`
   (aligns expo-audio/clipboard/file-system/sqlite versions with the SDK).
3. `npx expo start` → scan the QR with the Expo Go app (Android/iOS), phone on the same Wi-Fi.
4. In the app: Settings → paste the phone URL (and token if set) → Done → Record.

## Features

- Tap to record / tap to stop → transcript is cleaned (shared `@openwhispr/core` rules: fillers, stutters, punctuation, personal dictionary `misheard => correct`) and copied to the clipboard automatically.
- Voice commands work like desktop ("formato email: …", "… hazlo más corto") in rule mode (no Ollama on the phone).
- History stored in on-device SQLite (same `transcriptions` schema as desktop). Tap = copy, long-press = delete.
- Settings: server URL, token, language, cleanup on/off (off = raw transcript), save history on/off, personal dictionary.

## Known limitations

- Needs the desktop bridge running and both devices on the same network (that's the MVP trade-off; on-device whisper via whisper.rn is the documented upgrade path in `docs/mobile-architecture.md`).
- `usesCleartextTraffic` is enabled because the bridge is plain HTTP on your LAN.
- iOS Expo Go: local-network permission prompt must be accepted.
