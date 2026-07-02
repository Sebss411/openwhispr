# Local Text Pipeline (offline cleanup + voice commands)

The local text pipeline (`src/services/localtext/`) processes dictation transcripts entirely on-device, with no LLM, API key, account, or network. It runs automatically whenever no cleanup/agent model handles the transcript — i.e. on a fresh local-only install it is the default behavior.

## When it runs

`audioManager.processTranscription()` routes a finished transcript to (in order):

1. **Dictation agent** — if enabled, reachable, and addressed ("Hey [AgentName]…" or voice-agent hotkey).
2. **Cleanup LLM** — if a cleanup model is configured (local GGUF, BYOK, or cloud with sign-in).
3. **Local text pipeline** (this module) — everything else, including when the cleanup LLM errors out.
4. **Raw transcript** — when the cleanup toggle (Settings → AI Models) is off, or if the pipeline itself throws.

## What it does

Deterministic, conservative rules (Spanish + English) — it removes noise and fixes mechanics, it never rephrases:

- Personal dictionary corrections (see below)
- Hesitation removal: `um`, `uh`, `eh`, `mmm`, … and comma-delimited phrase fillers (`you know`, `o sea`, `¿vale?`, …)
- Stutter collapsing: `the the` → `the`, `I think I think` → `I think`
- Whitespace and punctuation spacing normalization
- Sentence capitalization and a terminal period for sentence-style dictation

## Personal dictionary corrections

In **Settings → Dictionary**, plain entries ("Qdrant") remain transcription hints. Entries written as `misheard => correct` (or `->`) also rewrite the transcript after transcription:

```
open whisper => OpenWhispr
cebs => Sebss
```

The corrected form is what gets hinted to Whisper; the rewrite is whole-word and case-insensitive.

## Voice commands

Speak a command at the **start** ("formato email: …") or **end** ("… Hazlo más corto") of your dictation:

| Command (es / en) | Without local LLM | With Ollama |
| --- | --- | --- |
| "solo corrige" / "just fix" | rule cleanup only | same |
| "sin cambiar mi tono" / "keep my tone" | rule cleanup only | same |
| "formato email" / "as an email" | greeting + body + sign-off template | LLM-formatted |
| "formato tweet" / "as a tweet" | trimmed to 280 chars | LLM rewrite |
| "puntos clave" / "key points" | one bullet per sentence | LLM bullets |
| "post de LinkedIn" / "linkedin post" | short paragraphs | LLM-formatted |
| "mensaje de WhatsApp" / "whatsapp message" | rule cleanup | LLM casual rewrite |
| "hazlo más corto" / "make it shorter" | cleaned text as-is | LLM shortening |
| "hazlo más profesional" / "more professional" | cleaned text as-is | LLM rewrite |
| "resumen" / "summarize" | cleaned text as-is | LLM summary |
| "traduce al inglés" / "translate to english" | cleaned text as-is | LLM translation |

Commands that require real generation return the cleaned text unchanged when no local LLM is available — the pipeline never invents content.

## Optional Ollama

If an [Ollama](https://ollama.com) server is running on `127.0.0.1:11434`, generation-type commands use it automatically (first installed model; override with `localStorage.ollamaModel` from the DevTools console, e.g. `localStorage.setItem("ollamaModel", "llama3.2")`). A 600 ms cached probe decides availability; any failure silently falls back to rules. Ollama is never required and is never contacted except at that local address.

## Portability

All modules in `src/services/localtext/` are pure ES modules with zero Electron/DOM/store dependencies (the Ollama client only needs `fetch`), so they can be shared with a future mobile app unchanged. Tests: `node --test test/services/localtext.test.js`.
