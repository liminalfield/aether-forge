import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import Database from 'better-sqlite3';

/**
 * Storage lives in the main process, and only here. The renderer reaches it
 * through the IPC contract.
 *
 * Migrations run forward on open, keyed off SQLite's `user_version`. The
 * campaign event log is append-only, so migrations may add tables and indexes
 * but must never rewrite recorded events — payload schema changes are handled
 * by upcasting on read (see 02-MODULE-CONTRACT.md), not by touching the log.
 */

export type Migration = {
  readonly version: number;
  readonly up: (db: Database.Database) => void;
};

/**
 * Bootstrap schema: just enough to prove the migration path works. The real
 * event/entity/blob tables arrive with the first feature milestone.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS schema_meta (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
      db.prepare('INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)').run(
        'created_by_schema_version',
        '1',
      );
    },
  },
];

/** Highest migration version this build knows how to produce. */
export const LATEST_SCHEMA_VERSION = MIGRATIONS.reduce((max, m) => Math.max(max, m.version), 0);

export function migrate(db: Database.Database): number {
  const current = db.pragma('user_version', { simple: true }) as number;

  if (current > LATEST_SCHEMA_VERSION) {
    throw new Error(
      `Database schema version ${current} is newer than this build supports ` +
        `(${LATEST_SCHEMA_VERSION}). Update the application to open this campaign.`,
    );
  }

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    db.transaction(() => {
      migration.up(db);
      db.pragma(`user_version = ${migration.version}`);
    })();
  }

  return db.pragma('user_version', { simple: true }) as number;
}

/**
 * Opens (creating if needed) a campaign database under the app data directory.
 *
 * @param userDataPath `app.getPath('userData')` — passed in rather than read
 *   from Electron so this module stays testable outside the app.
 */
export function openCampaignDatabase(
  userDataPath: string,
  campaignId = 'default',
): Database.Database {
  const directory = join(userDataPath, 'campaigns');
  mkdirSync(directory, { recursive: true });

  const db = new Database(join(directory, `${campaignId}.sqlite`));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);

  return db;
}
