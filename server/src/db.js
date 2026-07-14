import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
mkdirSync(dataDir, { recursive: true });

export const db = new Database(join(dataDir, 'impleo.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    api_key TEXT,
    provider TEXT,
    anthropic_key TEXT,
    gemini_key TEXT,
    openai_key TEXT,
    groq_key TEXT,
    anthropic_model TEXT,
    gemini_model TEXT,
    openai_model TEXT,
    groq_model TEXT
  );

  CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS qa_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    context TEXT,
    date TEXT NOT NULL
  );

  -- Semantic identity memory: one value per canonical identity key (father_name,
  -- date_of_birth, aadhaar_number, ...), entered once and reused across any form.
  -- canonical_key is the primary key so each identity value is a singleton, upserted
  -- on conflict. Kept separate from the profile blob (freeform) and never mixed with
  -- the settings table (API keys). See server/src/fieldRegistry.js for the valid keys.
  CREATE TABLE IF NOT EXISTS identity_memory (
    canonical_key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    source TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// Migrate installs created before multi-provider support: the settings table
// used to be just (id, api_key), where api_key was always an Anthropic key.
// Add the new columns if missing, then move that legacy key into anthropic_key
// and mark Anthropic as the active provider so nothing breaks on upgrade.
// (An earlier, short-lived version of this migration added xai_key/xai_model
// for an "xAI (Grok)" provider that was a mistake — Groq (api.groq.com) was
// the actually-requested provider, an unrelated service from xAI's Grok. Any
// install that already has those xai_* columns keeps them as harmless dead
// columns; nothing in the app reads/writes them anymore.)
const settingsCols = db.prepare('PRAGMA table_info(settings)').all().map((c) => c.name);
for (const [name, type] of Object.entries({
  provider: 'TEXT',
  anthropic_key: 'TEXT',
  gemini_key: 'TEXT',
  openai_key: 'TEXT',
  groq_key: 'TEXT',
  anthropic_model: 'TEXT',
  gemini_model: 'TEXT',
  openai_model: 'TEXT',
  groq_model: 'TEXT',
})) {
  if (!settingsCols.includes(name)) db.exec(`ALTER TABLE settings ADD COLUMN ${name} ${type}`);
}
db.exec(`
  UPDATE settings SET anthropic_key = api_key
    WHERE id = 1 AND anthropic_key IS NULL AND api_key IS NOT NULL;
  UPDATE settings SET provider = 'anthropic'
    WHERE id = 1 AND provider IS NULL AND anthropic_key IS NOT NULL;
`);
