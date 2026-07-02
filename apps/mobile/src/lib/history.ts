// Local transcription history using the shared schema
// (packages/core/schema/transcriptions.sql) so history is portable with desktop.
import { openDatabaseSync } from "expo-sqlite";

export interface HistoryEntry {
  id: number;
  timestamp: string;
  original_text: string;
  processed_text: string | null;
  processing_method: string;
}

const db = openDatabaseSync("openwhispr.db");
db.execSync(`CREATE TABLE IF NOT EXISTS transcriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  original_text TEXT NOT NULL,
  processed_text TEXT,
  is_processed BOOLEAN DEFAULT 0,
  processing_method TEXT DEFAULT 'none',
  agent_name TEXT,
  error TEXT
)`);

export function addEntry(originalText: string, processedText: string | null, method: string): void {
  db.runSync(
    "INSERT INTO transcriptions (original_text, processed_text, is_processed, processing_method) VALUES (?, ?, ?, ?)",
    [originalText, processedText, processedText ? 1 : 0, method]
  );
}

export function listEntries(limit = 50): HistoryEntry[] {
  return db.getAllSync<HistoryEntry>(
    "SELECT id, timestamp, original_text, processed_text, processing_method FROM transcriptions ORDER BY id DESC LIMIT ?",
    [limit]
  );
}

export function deleteEntry(id: number): void {
  db.runSync("DELETE FROM transcriptions WHERE id = ?", [id]);
}
