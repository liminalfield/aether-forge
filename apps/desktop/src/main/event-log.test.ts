import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describeEventLogContract } from '@aether-forge/core/testing';
import type Database from 'better-sqlite3';
import { afterAll, describe, expect, it } from 'vitest';

import { openCampaignDatabase } from './db';
import { openEventLog } from './event-log';
import { createUlidSource } from './ulid';

const temporaryDirectories: string[] = [];
const openDatabases: Database.Database[] = [];

function aCampaignOnDisk(): { db: Database.Database; path: string } {
  const path = mkdtempSync(join(tmpdir(), 'aether-forge-log-'));
  temporaryDirectories.push(path);
  const db = openCampaignDatabase(path);
  openDatabases.push(db);
  return { db, path };
}

afterAll(() => {
  for (const db of openDatabases) db.close();
  for (const path of temporaryDirectories) rmSync(path, { recursive: true, force: true });
});

// The same checks the in-memory log passes. Two implementations that pass the
// same checks are interchangeable, which is the point of core owning the
// interface and the application owning the storage.
describeEventLogContract('the SQLite log', {
  create: () => {
    const { db } = aCampaignOnDisk();
    let tick = 0;
    return openEventLog(db, 'campaign-under-test', {
      now: () => {
        tick += 1;
        return `2026-08-03T09:00:0${tick}.000Z`;
      },
      nextEventId: createUlidSource(),
    });
  },
});

describe('the database refuses to let the past change', () => {
  it('rejects an attempt to modify a recorded event', () => {
    const { db } = aCampaignOnDisk();
    const log = openEventLog(db, 'c', { now: () => 'now', nextEventId: createUlidSource() });
    log.append({ type: 'core.entry.created', schemaVersion: 1, payload: { text: 'as written' } });

    expect(() => db.prepare("UPDATE events SET payload = '{}' WHERE seq = 1").run()).toThrow(
      /append-only/,
    );
  });

  it('rejects an attempt to delete a recorded event', () => {
    const { db } = aCampaignOnDisk();
    const log = openEventLog(db, 'c', { now: () => 'now', nextEventId: createUlidSource() });
    log.append({ type: 'core.entry.created', schemaVersion: 1, payload: {} });

    expect(() => db.prepare('DELETE FROM events WHERE seq = 1').run()).toThrow(/append-only/);
    expect(log.count()).toEqual({ ok: true, value: 1 });
  });

  it('leaves the event untouched after a rejected change', () => {
    const { db } = aCampaignOnDisk();
    const log = openEventLog(db, 'c', { now: () => 'now', nextEventId: createUlidSource() });
    log.append({ type: 'core.entry.created', schemaVersion: 1, payload: { text: 'as written' } });

    try {
      db.prepare('UPDATE events SET payload = \'{"text":"tampered"}\' WHERE seq = 1').run();
    } catch {
      // expected, and the point is what the log says afterwards
    }

    const read = log.read();
    expect(read.ok && read.value[0]?.payload).toEqual({ text: 'as written' });
  });
});

describe('surviving a restart', () => {
  it('keeps events, and carries on numbering where it left off', () => {
    const { path } = aCampaignOnDisk();
    const environment = { now: () => 'now', nextEventId: createUlidSource() };

    const first = openCampaignDatabase(path);
    const before = openEventLog(first, 'c', environment);
    before.append({ type: 'core.entry.created', schemaVersion: 1, payload: { text: 'one' } });
    before.append({ type: 'core.entry.created', schemaVersion: 1, payload: { text: 'two' } });
    first.close();

    const second = openCampaignDatabase(path);
    openDatabases.push(second);
    const after = openEventLog(second, 'c', environment);

    expect(after.count()).toEqual({ ok: true, value: 2 });
    const appended = after.append({
      type: 'core.entry.created',
      schemaVersion: 1,
      payload: { text: 'three' },
    });
    expect(appended.ok && appended.value.seq).toBe(3);
  });
});

describe('reporting failure rather than throwing', () => {
  it('returns a failure when the log cannot be read', () => {
    const { db } = aCampaignOnDisk();
    const log = openEventLog(db, 'c', { now: () => 'now', nextEventId: createUlidSource() });
    log.append({ type: 'core.entry.created', schemaVersion: 1, payload: {} });

    // A row that no correct append could have written: a module event type
    // with no owning module. Only tampering produces this.
    db.exec('DROP TRIGGER events_cannot_be_changed');
    db.prepare("UPDATE events SET type = 'sys.somewhere.else' WHERE seq = 1").run();

    const read = log.read();
    expect(read.ok).toBe(false);
    expect(!read.ok && read.failure.kind).toBe('storage-failed');
  });
});
