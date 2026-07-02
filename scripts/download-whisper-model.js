#!/usr/bin/env node
// Downloads a Whisper GGML model into the cache directory the app reads
// (~/.cache/openwhispr/whisper-models), so local dictation works without
// going through the in-app download UI.
//
// Usage:
//   node scripts/download-whisper-model.js                 # base (recommended)
//   node scripts/download-whisper-model.js --model small
//   node scripts/download-whisper-model.js --list
const fs = require("fs");
const os = require("os");
const path = require("path");
const { downloadFile, parseArgs } = require("./lib/download-utils");

const registry = require("../src/models/modelRegistryData.json");
const MODELS = registry.whisperModels;
const MODELS_DIR = path.join(os.homedir(), ".cache", "openwhispr", "whisper-models");

function getFlagValue(flag) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : null;
}

async function main() {
  if (process.argv.includes("--list")) {
    console.log("\n[whisper-model] Available models:\n");
    for (const [name, info] of Object.entries(MODELS)) {
      const marker = info.recommended ? " (recommended)" : "";
      console.log(`  ${name.padEnd(22)} ${String(info.size).padEnd(8)} ${info.description}${marker}`);
    }
    console.log("");
    return;
  }

  const args = parseArgs();
  const modelName = getFlagValue("--model") || "base";
  const model = MODELS[modelName];
  if (!model) {
    console.error(
      `[whisper-model] Unknown model "${modelName}". Valid models: ${Object.keys(MODELS).join(", ")}`
    );
    process.exitCode = 1;
    return;
  }

  const destPath = path.join(MODELS_DIR, model.fileName);
  const expectedBytes = model.expectedSizeBytes || model.sizeMb * 1_000_000;

  if (fs.existsSync(destPath) && !args.isForce) {
    const stats = fs.statSync(destPath);
    if (stats.size >= expectedBytes * 0.95) {
      console.log(
        `[whisper-model] "${modelName}" already downloaded at ${destPath} (use --force to re-download)`
      );
      return;
    }
    console.log(`[whisper-model] "${modelName}" looks incomplete, re-downloading`);
  }

  fs.mkdirSync(MODELS_DIR, { recursive: true });
  console.log(`[whisper-model] Downloading ${modelName} (${model.size}) from ${model.downloadUrl}`);

  try {
    await downloadFile(model.downloadUrl, destPath);
    const stats = fs.statSync(destPath);
    if (stats.size < expectedBytes * 0.95) {
      throw new Error(
        `Downloaded file is smaller than expected (${stats.size} < ~${expectedBytes} bytes)`
      );
    }
    const sizeMB = (stats.size / 1024 / 1024).toFixed(0);
    console.log(`\n[whisper-model] "${modelName}" ready (${sizeMB}MB) at ${destPath}\n`);
  } catch (error) {
    console.error(`[whisper-model] Failed to download "${modelName}": ${error.message}`);
    if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
    process.exitCode = 1;
  }
}

main().catch(console.error);
