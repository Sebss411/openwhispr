# OpenWhispr Android Keyboard (IME)

Dictate into **any Android app**: a minimal voice keyboard that records on the phone, transcribes on **your own computer** (LAN bridge), and types the result at the cursor. No cloud, no accounts, single small APK with zero third-party dependencies.

> Status: complete code, **not compiled here** (no Android SDK on this machine). Open in Android Studio and it should build as-is; treat the first build as review+fix.

## Build & install

1. Open `apps/android-ime/` in Android Studio (it will generate the Gradle wrapper) → Run on your device, or `gradle assembleDebug` and install `app/build/outputs/apk/debug/app-debug.apk`.
2. On the desktop (repo root): `npm run serve:mobile` → note the `http://192.168.x.x:8380` URL.
3. On the phone, open the **OpenWhispr Keyboard** app: grant mic permission, paste the server URL (+ token/language), tap **Enable keyboard in system settings** and turn it on.
4. In any app, switch keyboards (⌨ key or the keyboard icon in the nav bar) → tap **🎙 Dictate** → speak → tap **■ Stop** → the text is typed into the field.

## Design notes

- `WavRecorder.kt` records 16kHz mono PCM WAV directly (whisper's native format), so the bridge's ffmpeg step is a pass-through.
- `BridgeClient.kt` uses `HttpURLConnection` — no OkHttp/coroutines, keeps the APK tiny.
- IMEs can't prompt for runtime permissions; `SettingsActivity` (the launcher icon) handles RECORD_AUDIO.
- Cleartext HTTP is enabled because the bridge is plain HTTP on your home LAN.
- Text cleanup runs **server-side**: the IME calls the bridge with `?clean=1`, which applies the same shared offline rules as desktop (fillers, stutters, punctuation) before returning the text. No JS runtime needed on the phone.
- The ⌫ key deletes one character; ⌨ opens the system keyboard switcher.
