#!/usr/bin/env node
// Private Flow Mobile Bridge — LAN transcription bridge for the mobile app / Android IME.
//
// The desktop app's whisper-server binds to 127.0.0.1 on purpose; this
// opt-in script reuses the same binary and downloaded models to expose a
// minimal transcription endpoint on your LAN (home network only — there is
// no TLS; use --token for a shared secret). Audio in any format is converted
// to 16kHz mono WAV with the repo's bundled ffmpeg before inference. Nothing
// ever leaves your machines.
//
// Usage:
//   npm run serve:mobile                        # base model, port 8380
//   npm run serve:mobile -- --model small --port 8380 --token mysecret
//
// API:
//   GET  /health              -> { ok: true, model }
//   POST /transcribe?lang=es  -> body: raw audio bytes (any ffmpeg-readable
//                                format) -> { text }
//        &clean=1             -> also run the shared offline cleanup pipeline
//                                (src/services/localtext) on the transcript;
//                                used by clients that can't run the JS rules
//                                themselves (e.g. the Android IME)
//        optional header X-Token when --token is set

const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const registry = require("../src/models/modelRegistryData.json");

function flag(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

const MODEL_NAME = flag("model", "base");
const PORT = Number(flag("port", "8380"));
const TOKEN = flag("token", null);
// Default binds to all interfaces so phones on the LAN can reach it; pass
// --host 127.0.0.1 to keep it machine-local (e.g. for testing).
const HOST = flag("host", "0.0.0.0");
const WHISPER_PORT = PORT + 1;

const modelInfo = registry.whisperModels[MODEL_NAME];
if (!modelInfo) {
  console.error(`Unknown model "${MODEL_NAME}". Valid: ${Object.keys(registry.whisperModels).join(", ")}`);
  process.exit(1);
}
const modelPath = path.join(os.homedir(), ".cache", "openwhispr", "whisper-models", modelInfo.fileName);
if (!fs.existsSync(modelPath)) {
  console.error(`Model not downloaded: ${modelPath}\nRun: npm run download:local-model -- --model ${MODEL_NAME}`);
  process.exit(1);
}

const ext = process.platform === "win32" ? ".exe" : "";
const serverBinary = path.join(
  __dirname,
  "..",
  "resources",
  "bin",
  `whisper-server-${process.platform}-${process.arch}${ext}`
);
if (!fs.existsSync(serverBinary)) {
  console.error(`whisper-server binary not found: ${serverBinary}\nRun: npm run download:local-whisper`);
  process.exit(1);
}

const ffmpegPath = require("ffmpeg-static");

function convertToWav16k(inputBuffer) {
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpegPath, [
      "-hide_banner",
      "-loglevel", "error",
      "-i", "pipe:0",
      "-ar", "16000",
      "-ac", "1",
      "-f", "wav",
      "pipe:1",
    ]);
    const chunks = [];
    const errors = [];
    ff.stdout.on("data", (c) => chunks.push(c));
    ff.stderr.on("data", (c) => errors.push(c));
    ff.on("error", reject);
    ff.on("close", (code) => {
      if (code === 0 && chunks.length) resolve(Buffer.concat(chunks));
      else reject(new Error(`ffmpeg failed (${code}): ${Buffer.concat(errors).toString().slice(0, 400)}`));
    });
    ff.stdin.on("error", () => {}); // ignore EPIPE if ffmpeg exits early
    ff.stdin.end(inputBuffer);
  });
}

async function inference(wavBuffer, language) {
  const form = new FormData();
  form.append("file", new Blob([wavBuffer], { type: "audio/wav" }), "audio.wav");
  form.append("language", language || "auto");
  form.append("response_format", "json");
  const res = await fetch(`http://127.0.0.1:${WHISPER_PORT}/inference`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`whisper-server HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const data = await res.json();
  return (data.text || "").trim();
}

function readBody(req, maxBytes = 50 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > maxBytes) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function waitForWhisper(retries = 60) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${WHISPER_PORT}/`, { method: "GET" });
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("whisper-server did not become ready");
}

async function main() {
  console.log(`[bridge] starting whisper-server (${MODEL_NAME}) on 127.0.0.1:${WHISPER_PORT}...`);
  const whisper = spawn(
    serverBinary,
    ["--model", modelPath, "--host", "127.0.0.1", "--port", String(WHISPER_PORT)],
    { stdio: ["ignore", "ignore", "inherit"] }
  );
  whisper.on("close", (code) => {
    console.error(`[bridge] whisper-server exited (${code}); shutting down`);
    process.exit(code || 1);
  });
  const shutdown = () => {
    whisper.kill();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await waitForWhisper();
  console.log("[bridge] whisper-server ready");

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (TOKEN && req.headers["x-token"] !== TOKEN) {
        return json(res, 401, { error: "Invalid or missing X-Token header" });
      }
      if (req.method === "GET" && url.pathname === "/health") {
        return json(res, 200, { ok: true, model: MODEL_NAME });
      }
      if (req.method === "POST" && url.pathname === "/transcribe") {
        const audio = await readBody(req);
        if (!audio.length) return json(res, 400, { error: "Empty body" });
        const started = Date.now();
        const wav = await convertToWav16k(audio);
        const lang = url.searchParams.get("lang");
        let text = await inference(wav, lang);
        if (text && url.searchParams.get("clean") === "1") {
          const { processTranscriptLocally } = await import("../src/services/localtext/index.js");
          const result = await processTranscriptLocally(text, {
            language: lang || "auto",
            allowOllama: false,
          });
          text = result.text || text;
        }
        console.log(
          `[bridge] transcribed ${(audio.length / 1024).toFixed(0)}KB in ${Date.now() - started}ms: "${text.slice(0, 60)}${text.length > 60 ? "…" : ""}"`
        );
        return json(res, 200, { text });
      }
      json(res, 404, { error: "Not found" });
    } catch (error) {
      console.error(`[bridge] request failed: ${error.message}`);
      json(res, 500, { error: error.message });
    }
  });

  server.listen(PORT, HOST, () => {
    const nets = os.networkInterfaces();
    const ips = Object.values(nets)
      .flat()
      .filter((n) => n && n.family === "IPv4" && !n.internal)
      .map((n) => n.address);
    console.log(`\n[bridge] Private Flow Mobile Bridge listening on port ${PORT} (model: ${MODEL_NAME})`);
    for (const ip of ips) console.log(`[bridge]   phone URL: http://${ip}:${PORT}`);
    if (!TOKEN) {
      console.log("[bridge] WARNING: no --token set — anyone on your network can transcribe. Home LAN only.");
    }
    console.log("[bridge] Ctrl+C to stop\n");
  });
}

main().catch((error) => {
  console.error(`[bridge] fatal: ${error.message}`);
  process.exit(1);
});
