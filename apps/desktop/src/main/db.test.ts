import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LATEST_SCHEMA_VERSION, openCampaignDatabase } from './db';

describe('campaign database', () => {
  let userData: string;

  beforeEach(() => {
    userData = mkdtempSync(join(tmpdir(), 'aether-forge-test-'));
  });

  afterEach(() => {
    rmSync(userData, { recursive: true, force: true });
  });

  it('creates the database under campaigns/ and migrates to the latest schema', () => {
    const db = openCampaignDatabase(userData);
    try {
      expect(db.pragma('user_version', { simple: true })).toBe(LATEST_SCHEMA_VERSION);
      expect(db.name).toContain(join('campaigns', 'default.sqlite'));
    } finally {
      db.close();
    }
  });

  it('is idempotent across reopens', () => {
    openCampaignDatabase(userData).close();
    const db = openCampaignDatabase(userData);
    try {
      expect(db.pragma('user_version', { simple: true })).toBe(LATEST_SCHEMA_VERSION);
    } finally {
      db.close();
    }
  });

  it('refuses to open a database written by a newer build', () => {
    const db = openCampaignDatabase(userData);
    db.pragma(`user_version = ${LATEST_SCHEMA_VERSION + 1}`);
    db.close();

    expect(() => openCampaignDatabase(userData)).toThrow(/newer than this build supports/);
  });
});
