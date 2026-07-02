const test = require("node:test");
const assert = require("node:assert/strict");

const loadCleanup = () => import("../../src/services/localtext/localCleanup.js");
const loadDictionary = () => import("../../src/services/localtext/personalDictionary.js");
const loadCommands = () => import("../../src/services/localtext/voiceCommands.js");
const loadPipeline = () => import("../../src/services/localtext/index.js");

// --- personal dictionary ---

test("parseDictionaryEntries splits hints and corrections", async () => {
  const { parseDictionaryEntries } = await loadDictionary();
  const { hintWords, replacements } = parseDictionaryEntries([
    "Qdrant",
    "cebs => Sebss",
    "jear pe te -> GPT",
    "  ",
  ]);
  assert.deepEqual(hintWords, ["Qdrant", "Sebss", "GPT"]);
  assert.deepEqual(replacements, [
    { from: "cebs", to: "Sebss" },
    { from: "jear pe te", to: "GPT" },
  ]);
});

test("applyReplacements is whole-word and case-insensitive", async () => {
  const { applyReplacements } = await loadDictionary();
  const out = applyReplacements("Cebs y cebsito hablaron con CEBS", [{ from: "cebs", to: "Sebss" }]);
  assert.equal(out, "Sebss y cebsito hablaron con Sebss");
});

// --- rule-based cleanup ---

test("cleanupTranscript removes hesitations and stutters in Spanish", async () => {
  const { cleanupTranscript } = await loadCleanup();
  const out = cleanupTranscript("eh bueno quiero quiero que el informe esté listo mañana", {
    language: "es",
  });
  assert.equal(out, "Bueno quiero que el informe esté listo mañana.");
});

test("cleanupTranscript removes fillers and fixes spacing in English", async () => {
  const { cleanupTranscript } = await loadCleanup();
  const out = cleanupTranscript("um so the the report , you know, is ready", { language: "en" });
  assert.equal(out, "So the report, is ready.");
});

test("cleanupTranscript keeps short fragments unterminated", async () => {
  const { cleanupTranscript } = await loadCleanup();
  assert.equal(cleanupTranscript("mañana a las 10", { language: "es" }), "Mañana a las 10");
});

test("cleanupTranscript applies dictionary corrections", async () => {
  const { cleanupTranscript } = await loadCleanup();
  const out = cleanupTranscript("hablé con open whisper sobre el proyecto y me gustó open whisper", {
    language: "es",
    replacements: [{ from: "open whisper", to: "OpenWhispr" }],
  });
  assert.equal(out, "Hablé con OpenWhispr sobre el proyecto y me gustó OpenWhispr.");
});

test("cleanupTranscript does not touch real words containing filler substrings", async () => {
  const { cleanupTranscript } = await loadCleanup();
  const out = cleanupTranscript("Ahmed ehms the umpire hummed", { language: "en" });
  assert.equal(out, "Ahmed ehms the umpire hummed");
});

test("collapseRepetitions collapses repeated bigrams", async () => {
  const { collapseRepetitions } = await loadCleanup();
  assert.equal(collapseRepetitions("I think I think this works"), "I think this works");
});

// --- voice commands ---

test("detectVoiceCommand matches a leading Spanish command", async () => {
  const { detectVoiceCommand } = await loadCommands();
  const match = detectVoiceCommand("formato email: necesito el informe para el viernes");
  assert.equal(match.command.id, "email");
  assert.equal(match.body, "necesito el informe para el viernes");
});

test("detectVoiceCommand matches a trailing English command", async () => {
  const { detectVoiceCommand } = await loadCommands();
  const match = detectVoiceCommand("The meeting moved to Friday. Make it shorter");
  assert.equal(match.command.id, "shorter");
  assert.equal(match.body, "The meeting moved to Friday");
});

test("detectVoiceCommand returns null for plain dictation", async () => {
  const { detectVoiceCommand } = await loadCommands();
  assert.equal(detectVoiceCommand("hoy comí un resumen de noticias en el desayuno"), null);
});

test("applyCommandRules formats key points and trims tweets", async () => {
  const { applyCommandRules } = await loadCommands();
  const bullets = applyCommandRules("keyPoints", "Primero esto. Luego aquello.");
  assert.equal(bullets.text, "- Primero esto\n- Luego aquello");

  const long = "palabra ".repeat(60).trim();
  const tweet = applyCommandRules("tweet", long);
  assert.ok(tweet.text.length <= 280);
  assert.ok(tweet.text.endsWith("…"));
});

test("applyCommandRules marks generation commands as needing an LLM", async () => {
  const { applyCommandRules } = await loadCommands();
  const out = applyCommandRules("translateEn", "hola mundo");
  assert.equal(out.text, "hola mundo");
  assert.equal(out.needsLLM, true);
});

// --- orchestrator (offline, no Ollama) ---

test("processTranscriptLocally cleans and applies commands without Ollama", async () => {
  const { processTranscriptLocally } = await loadPipeline();
  const result = await processTranscriptLocally(
    "formato email: eh necesito el el informe para el viernes",
    { language: "es", allowOllama: false }
  );
  assert.equal(result.command, "email");
  assert.equal(result.usedOllama, false);
  assert.ok(result.text.startsWith("Hola,\n\n"));
  assert.ok(result.text.includes("Necesito el informe para el viernes"));
  assert.ok(result.text.endsWith("Un saludo"));
});

test("processTranscriptLocally without command returns cleaned text", async () => {
  const { processTranscriptLocally } = await loadPipeline();
  const result = await processTranscriptLocally("um hello hello world", {
    language: "en",
    allowOllama: false,
  });
  assert.equal(result.command, null);
  assert.equal(result.text, "Hello world");
});
