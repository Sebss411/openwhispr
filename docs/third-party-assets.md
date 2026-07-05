# Private Flow — Third-Party Assets & Attribution

Private Flow is a private, local-first fork of the open-source **OpenWhispr**
project (MIT). It bundles third-party binaries and models at build time. This
file lists each asset and its license/attribution.

Licenses marked **(verify)** should be confirmed against the linked source before
redistribution — they are the maintainer's best current understanding, not legal
advice. Do not remove upstream `LICENSE`/`NOTICE` files when redistributing.

## Application code

| Component | Source | License |
|---|---|---|
| Private Flow (this app) | Fork of `OpenWhispr/openwhispr` | MIT (see repo `LICENSE`, © 2024 OpenWhispr Team) |

## Binaries (build-time, shipped in `resources/bin`)

| Asset | Upstream | License |
|---|---|---|
| whisper-server + ggml DLLs | `OpenWhispr/whisper.cpp` (fork of `ggerganov/whisper.cpp`) | MIT |
| llama-server + llama/ggml DLLs | `ggml-org/llama.cpp` (tag `b9763`) | MIT |
| sherpa-onnx (ws server, diarize) + `sherpa-onnx-*.dll` | `k2-fsa/sherpa-onnx` (v1.12.23) | Apache-2.0 |
| onnxruntime.dll | Microsoft ONNX Runtime (shipped via sherpa-onnx) | MIT |
| qdrant | `qdrant/qdrant` | Apache-2.0 |
| FFmpeg (`ffmpeg-static`) | npm `ffmpeg-static` | **(verify)** FFmpeg is LGPL-2.1+/GPL depending on the build; confirm the exact `ffmpeg-static` build flavor |
| nircmd.exe | NirSoft (`nirsoft.net`) | **(verify)** NirSoft freeware — free to use/redistribute under NirSoft's terms; **not** OSI open source |
| meeting-aec-helper | `OpenWhispr/openwhispr` release | MIT (part of the OpenWhispr project) |
| windows-key-listener | `OpenWhispr/openwhispr` release | MIT |
| windows-fast-paste | `OpenWhispr/openwhispr` release | MIT |
| windows-mic-listener | `OpenWhispr/openwhispr` release | MIT |
| windows-text-monitor | `OpenWhispr/openwhispr` release | MIT |

## Models

| Asset | Upstream | License |
|---|---|---|
| Whisper GGML models (`ggml-base.bin`, small, …) | HF `ggerganov/whisper.cpp` | MIT (model weights originate from OpenAI Whisper, MIT) |
| Silero VAD (`ggml-silero-v5.1.2.bin`) | HF `ggml-org/whisper-vad` | **(verify)** Silero VAD is MIT; confirm the ggml conversion |
| all-MiniLM-L6-v2 (`model.onnx`, `tokenizer.json`) | HF `sentence-transformers/all-MiniLM-L6-v2` | Apache-2.0 |
| Diarization: pyannote segmentation 3.0 | `k2-fsa/sherpa-onnx` release `speaker-segmentation-models` | **(verify)** pyannote model — check the model card (MIT/other) |
| Diarization: 3D-Speaker CAM++ embedding | `k2-fsa/sherpa-onnx` release `speaker-recongition-models` | **(verify)** 3D-Speaker — typically Apache-2.0 |
| Diarization: `silero_vad.onnx` | `k2-fsa/sherpa-onnx` release `asr-models` | **(verify)** Silero VAD — MIT |

## Optional runtime models (downloaded on demand, not bundled)

| Asset | Upstream | License |
|---|---|---|
| NVIDIA Parakeet ASR (`parakeet-*`) | `k2-fsa/sherpa-onnx` `asr-models` (NeMo weights) | **(verify)** NVIDIA/NeMo model license (often CC-BY-4.0) |
| Local LLM GGUFs (Qwen, Llama, Mistral, Gemma, GPT-OSS) | HuggingFace (bartowski, Qwen, ggml-org, mradermacher) | **(verify)** per-model — each has its own license (Apache-2.0 / Llama / Gemma / MIT …) |

## Notes

- The OpenWhispr helper binaries and the `whisper.cpp` fork come from
  OpenWhispr-owned repositories; they are covered by the OpenWhispr project's MIT
  license. Keep attribution to OpenWhispr.
- For a fully self-hosted "forever build", mirror these assets to your own
  release and/or the offline bundle (see `docs/forever-build.md`). Preserve each
  upstream's license/attribution when you do.
