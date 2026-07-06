// Private Flow — forever-build asset descriptor (single source of truth).
//
// Lists every binary/model Private Flow needs to run offline on Windows x64,
// where it lives locally, where it comes from upstream, and where it goes inside
// the offline bundle. Consumed by scripts/assets-*.js and scripts/setup-offline.js.
//
// This file is DATA + tiny helpers only (no network). sha256/size are computed
// live from disk by the assets:* scripts, never hardcoded here (so they never drift).

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const REPO_ROOT = path.join(__dirname, "..", "..");
const BUNDLE_DIR = path.join(REPO_ROOT, "artifacts", "private-flow-offline-bundle");
const APP_NAME = "Private Flow";

// Placeholder base for a self-hosted GitHub release of the fork. Real value is
// supplied at download time via env PRIVATE_FLOW_ASSET_BASE_URL or
// package.json → privateFlow.assetBaseUrl (see scripts/lib/asset-source.js).
const PRIVATE_RELEASE_PLACEHOLDER =
  "https://github.com/<owner>/<repo>/releases/download/private-flow-assets-v1";

// category: binary | helper | model | embedding | vad
// owned=true  -> asset lives in an OpenWhispr-owned GitHub release (the real
//                "forever build" risk; upstream fallback is gated off by default).
// owned=false -> neutral third-party upstream (kept as a fallback source).
// localPath / bundleRelPath: "~/..." = home dir, otherwise relative to repo root.
const ASSETS = [
  // ---- Core binaries (Windows x64) ----
  {
    name: "whisper-server",
    category: "binary",
    platform: "win32",
    arch: "x64",
    required: true,
    owned: true,
    localPath: "resources/bin/whisper-server-win32-x64.exe",
    bundleRelPath: "windows-x64/bin/whisper-server-win32-x64.exe",
    releaseFileName: "whisper-server-win32-x64-cpu.zip",
    upstreamRepo: "OpenWhispr/whisper.cpp",
    upstreamTag: "latest",
    notes:
      "whisper.cpp server (local STT). Ships with sibling ggml-*.dll — the whole resources/bin dir is bundled so the DLLs travel with it. Pin the exact upstream tag when mirroring.",
  },
  {
    name: "llama-server",
    category: "binary",
    platform: "win32",
    arch: "x64",
    required: true,
    owned: false,
    localPath: "resources/bin/llama-server-win32-x64-cpu.exe",
    bundleRelPath: "windows-x64/bin/llama-server-win32-x64-cpu.exe",
    releaseFileName: "llama-b9763-bin-win-cpu-x64.zip",
    upstreamRepo: "ggml-org/llama.cpp",
    upstreamTag: "b9763",
    notes:
      "Local LLM inference (cleanup/agent). Extracts server launcher + llama*.dll/ggml*.dll/mtmd.dll — bundled via full resources/bin.",
  },
  {
    name: "sherpa-onnx",
    category: "binary",
    platform: "win32",
    arch: "x64",
    required: true,
    owned: false,
    localPath: "resources/bin/sherpa-onnx-ws-win32-x64.exe",
    bundleRelPath: "windows-x64/bin/sherpa-onnx-ws-win32-x64.exe",
    releaseFileName: "sherpa-onnx-v1.12.23-win-x64-shared.tar.bz2",
    upstreamUrl:
      "https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.12.23/sherpa-onnx-v1.12.23-win-x64-shared.tar.bz2",
    notes:
      "Parakeet ASR websocket server + diarization + onnxruntime.dll. Version pinned in scripts/download-sherpa-onnx.js (SHERPA_ONNX_VERSION).",
  },
  {
    name: "qdrant",
    category: "binary",
    platform: "win32",
    arch: "x64",
    required: true,
    owned: false,
    localPath: "resources/bin/qdrant-win32-x64.exe",
    bundleRelPath: "windows-x64/bin/qdrant-win32-x64.exe",
    releaseFileName: "qdrant-x86_64-pc-windows-msvc.zip",
    upstreamRepo: "qdrant/qdrant",
    upstreamTag: "latest",
    notes: "Local vector DB for semantic note search (~85 MB, largest binary).",
  },

  // ---- Optional helper binaries (Windows x64) — all have JS/tap fallbacks ----
  {
    name: "meeting-aec-helper",
    category: "helper",
    platform: "win32",
    arch: "x64",
    required: false,
    owned: true,
    localPath: "resources/bin/meeting-aec-helper-win32-x64.exe",
    bundleRelPath: "windows-x64/bin/meeting-aec-helper-win32-x64.exe",
    releaseFileName: "meeting-aec-helper-win32-x64.zip",
    upstreamRepo: "OpenWhispr/openwhispr",
    upstreamTag: "meeting-aec-helper-v*",
    notes: "Acoustic echo cancellation. Falls back to JS echo-leak detector if missing.",
  },
  {
    name: "windows-key-listener",
    category: "helper",
    platform: "win32",
    arch: "x64",
    required: false,
    owned: true,
    localPath: "resources/bin/windows-key-listener.exe",
    bundleRelPath: "windows-x64/bin/windows-key-listener.exe",
    releaseFileName: "windows-key-listener-win32-x64.zip",
    upstreamRepo: "OpenWhispr/openwhispr",
    upstreamTag: "windows-key-listener-v*",
    notes: "Push-to-talk low-level keyboard hook. Falls back to tap mode. Can be compiled locally (compile:winkeys).",
  },
  {
    name: "windows-fast-paste",
    category: "helper",
    platform: "win32",
    arch: "x64",
    required: false,
    owned: true,
    localPath: "resources/bin/windows-fast-paste.exe",
    bundleRelPath: "windows-x64/bin/windows-fast-paste.exe",
    releaseFileName: "windows-fast-paste-win32-x64.zip",
    upstreamRepo: "OpenWhispr/openwhispr",
    upstreamTag: "windows-fast-paste-v*",
    notes: "Fast auto-paste. Falls back to nircmd/PowerShell SendKeys. Can be compiled locally (compile:winpaste).",
  },
  {
    name: "windows-mic-listener",
    category: "helper",
    platform: "win32",
    arch: "x64",
    required: false,
    owned: true,
    localPath: "resources/bin/windows-mic-listener.exe",
    bundleRelPath: "windows-x64/bin/windows-mic-listener.exe",
    releaseFileName: "windows-mic-listener-win32-x64.zip",
    upstreamRepo: "OpenWhispr/openwhispr",
    upstreamTag: "windows-mic-listener-v*",
    notes: "Event-driven mic detection for meetings. Falls back to polling. Not currently present on disk.",
  },
  {
    name: "windows-text-monitor",
    category: "helper",
    platform: "win32",
    arch: "x64",
    required: false,
    owned: true,
    localPath: "resources/bin/windows-text-monitor.exe",
    bundleRelPath: "windows-x64/bin/windows-text-monitor.exe",
    releaseFileName: "windows-text-monitor-win32-x64.zip",
    upstreamRepo: "OpenWhispr/openwhispr",
    upstreamTag: "windows-text-monitor-v*",
    notes: "Auto-learn corrections. Compiled locally via compile:text-monitor (not wired to a download hook).",
  },
  {
    name: "nircmd",
    category: "helper",
    platform: "win32",
    arch: "x64",
    required: false,
    owned: false,
    localPath: "resources/bin/nircmd.exe",
    bundleRelPath: "windows-x64/bin/nircmd.exe",
    releaseFileName: "nircmd-x64.zip",
    upstreamUrl: "https://www.nirsoft.net/utils/nircmd-x64.zip",
    notes: "NirSoft paste fallback. Non-GitHub source; mirror separately if desired.",
  },

  // ---- Models ----
  {
    name: "whisper-vad-model",
    category: "vad",
    platform: "any",
    arch: "any",
    required: true,
    owned: false,
    localPath: "resources/bin/whisper-vad/ggml-silero-v5.1.2.bin",
    bundleRelPath: "windows-x64/bin/whisper-vad/ggml-silero-v5.1.2.bin",
    releaseFileName: "ggml-silero-v5.1.2.bin",
    upstreamUrl: "https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin",
    notes: "Silero VAD for voice-activity gating.",
  },
  {
    name: "whisper-model-base",
    category: "model",
    platform: "any",
    arch: "any",
    required: true,
    owned: false,
    localPath: "~/.cache/openwhispr/whisper-models/ggml-base.bin",
    bundleRelPath: "models/whisper-models/ggml-base.bin",
    releaseFileName: "ggml-base.bin",
    upstreamUrl: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
    notes: "Default recommended Whisper model (~142 MB). Minimum for offline dictation.",
  },
  {
    name: "whisper-model-small",
    category: "model",
    platform: "any",
    arch: "any",
    required: false,
    owned: false,
    localPath: "~/.cache/openwhispr/whisper-models/ggml-small.bin",
    bundleRelPath: "models/whisper-models/ggml-small.bin",
    releaseFileName: "ggml-small.bin",
    upstreamUrl: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
    notes: "Higher-accuracy model (~466 MB). Optional. Get it with: npm run download:local-model -- --model small",
  },
  {
    name: "embedding-minilm-model",
    category: "embedding",
    platform: "any",
    arch: "any",
    required: true,
    owned: false,
    localPath: "~/.cache/openwhispr/embedding-models/all-MiniLM-L6-v2/model.onnx",
    bundleRelPath: "models/embedding-models/all-MiniLM-L6-v2/model.onnx",
    // MUST equal the upstream basename: the resolver (asset-source.js) fetches by
    // assetNameFromUrl(upstreamUrl), i.e. "model.onnx". Upload it to your release
    // under exactly this name or PRIVATE_FLOW_ASSET_BASE_URL 404s and silently
    // falls back to HuggingFace.
    releaseFileName: "model.onnx",
    upstreamUrl:
      "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/onnx/model.onnx",
    notes: "Local text embeddings for semantic search (~90 MB).",
  },
  {
    name: "embedding-minilm-tokenizer",
    category: "embedding",
    platform: "any",
    arch: "any",
    required: true,
    owned: false,
    localPath: "~/.cache/openwhispr/embedding-models/all-MiniLM-L6-v2/tokenizer.json",
    bundleRelPath: "models/embedding-models/all-MiniLM-L6-v2/tokenizer.json",
    // MUST equal the upstream basename ("tokenizer.json") — see model.onnx above.
    releaseFileName: "tokenizer.json",
    upstreamUrl:
      "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/tokenizer.json",
    notes: "Tokenizer for the MiniLM embedding model.",
  },
  {
    name: "diarization-segmentation",
    category: "model",
    platform: "any",
    arch: "any",
    required: false,
    owned: false,
    localPath: "resources/bin/diarization-models/sherpa-onnx-pyannote-segmentation-3-0/model.onnx",
    bundleRelPath: "windows-x64/bin/diarization-models/sherpa-onnx-pyannote-segmentation-3-0/model.onnx",
    releaseFileName: "sherpa-onnx-pyannote-segmentation-3-0.tar.bz2",
    upstreamUrl:
      "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-segmentation-models/sherpa-onnx-pyannote-segmentation-3-0.tar.bz2",
    notes: "Speaker segmentation for diarization.",
  },
  {
    name: "diarization-embedding",
    category: "model",
    platform: "any",
    arch: "any",
    required: false,
    owned: false,
    localPath: "resources/bin/diarization-models/3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx",
    bundleRelPath: "windows-x64/bin/diarization-models/3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx",
    releaseFileName: "3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx",
    upstreamUrl:
      "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx",
    notes: "Speaker embedding for diarization.",
  },
];

// ---- helpers ----
function resolvePath(token) {
  if (!token) return null;
  if (token.startsWith("~/")) return path.join(os.homedir(), token.slice(2));
  if (token === "~") return os.homedir();
  return path.join(REPO_ROOT, token);
}

function fileExists(token) {
  const p = resolvePath(token);
  try {
    return !!p && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function fileSize(token) {
  const p = resolvePath(token);
  try {
    return fs.statSync(p).size;
  } catch {
    return null;
  }
}

function sha256Of(absPath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(absPath));
  return hash.digest("hex");
}

function sha256OfToken(token) {
  const p = resolvePath(token);
  try {
    if (!p || !fs.statSync(p).isFile()) return null;
    return sha256Of(p);
  } catch {
    return null;
  }
}

function bundleRelPath(asset) {
  return asset.bundleRelPath;
}

function bundleAbsPath(asset) {
  return path.join(BUNDLE_DIR, asset.bundleRelPath);
}

module.exports = {
  APP_NAME,
  REPO_ROOT,
  BUNDLE_DIR,
  PRIVATE_RELEASE_PLACEHOLDER,
  ASSETS,
  resolvePath,
  fileExists,
  fileSize,
  sha256Of,
  sha256OfToken,
  bundleRelPath,
  bundleAbsPath,
};
