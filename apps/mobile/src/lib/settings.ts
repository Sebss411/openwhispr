// Mobile settings, persisted as a single JSON row in SQLite. Shape follows
// packages/core/schema/settings.schema.json.
import { openDatabaseSync } from "expo-sqlite";

export interface MobileSettings {
  preferredLanguage: string;
  useCleanupModel: boolean;
  saveHistory: boolean;
  customDictionary: string[];
  transcriptionServerUrl: string;
  serverToken: string;
}

export const DEFAULT_SETTINGS: MobileSettings = {
  preferredLanguage: "auto",
  useCleanupModel: true,
  saveHistory: true,
  customDictionary: [],
  transcriptionServerUrl: "",
  serverToken: "",
};

const db = openDatabaseSync("openwhispr.db");
db.execSync(
  "CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL)"
);

export function loadSettings(): MobileSettings {
  const row = db.getFirstSync<{ json: string }>("SELECT json FROM settings WHERE id = 1");
  if (!row) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(row.json) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: MobileSettings): void {
  db.runSync(
    "INSERT INTO settings (id, json) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json",
    [JSON.stringify(settings)]
  );
}
