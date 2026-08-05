import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { launchPackagedApp } from '../e2e/packaged-app';
import { openCampaignDatabase } from '../src/main/db';
import { declareEventTypes } from '../src/main/event-types';
import { openEventLog } from '../src/main/event-log';
import { createUlidSource } from '../src/main/ulid';
import { createTranslatingLog, ENTRY_CREATED } from '@aether-forge/core';

/**
 * How large does a journal get before it stops being instant?
 *
 * The design record says a journal is small enough to send whole and draw whole
 * at the sizes a solo campaign plausibly reaches. Nobody had measured it, and
 * "plausibly" was doing real work in that sentence.
 *
 * Seeds a campaign through the real log, then launches the packaged application
 * against it, so the numbers are about the thing that ships rather than about a
 * model of it.
 */

const SIZES = [0, 100, 1_000, 2_500, 5_000, 10_000];

/** Roughly what a person writes in one go. */
const AN_ENTRY =
  'The airlock did not open. I stood there long enough to hear the pumps cycle twice, ' +
  'and then I went to find something to lever it with.';

function aCampaignOf(entries: number): { userDataDir: string; bytesOnDisk: number } {
  const userDataDir = mkdtempSync(join(tmpdir(), 'aether-forge-measure-'));
  const db = openCampaignDatabase(userDataDir, 'default');

  const log = createTranslatingLog(
    openEventLog(db, 'default', {
      now: () => new Date().toISOString(),
      nextEventId: createUlidSource(),
    }),
    declareEventTypes(),
  );

  const writeAll = db.transaction(() => {
    for (let index = 0; index < entries; index += 1) {
      log.append({ type: ENTRY_CREATED, payload: { text: `${index + 1}. ${AN_ENTRY}` } });
    }
  });
  writeAll();

  // Closing first, so that the write-ahead log is folded into the database
  // file. Measuring before that reports four kilobytes for any campaign,
  // however large, because the data is all still in the sidecar.
  db.close();

  const campaigns = join(userDataDir, 'campaigns');
  const bytesOnDisk = readdirSync(campaigns)
    .map((entry) => statSync(join(campaigns, entry)).size)
    .reduce((total, size) => total + size, 0);

  return { userDataDir, bytesOnDisk };
}

test('how a journal grows', async () => {
  const rows: string[] = [];

  for (const entries of SIZES) {
    const { userDataDir, bytesOnDisk } = aCampaignOf(entries);

    try {
      const startedAt = Date.now();
      const app = await launchPackagedApp(userDataDir);
      const page = await app.firstWindow();

      // Waiting for the entries themselves, so this measures time until a
      // person can read their campaign, not until a window exists.
      if (entries === 0) {
        await expect(page.getByText('Nothing written yet.')).toBeVisible({ timeout: 120_000 });
      } else {
        await expect(page.getByTestId('entry')).toHaveCount(entries, { timeout: 120_000 });
      }
      const visibleAfter = Date.now() - startedAt;

      // Separated on purpose. If the cost is in fetching, the answer is to send
      // less. If it is in drawing, the answer is to draw less. They are
      // different pieces of work and the number should say which.
      const asked = await page.evaluate(async () => {
        const startedAt = performance.now();
        const journal = await window.aetherForge.readJournal();
        const askedFor = performance.now() - startedAt;
        return { askedFor: Math.round(askedFor), bytes: JSON.stringify(journal).length };
      });

      rows.push(
        [
          String(entries).padStart(6),
          `${String(visibleAfter).padStart(6)} ms`,
          `${String(asked.askedFor).padStart(6)} ms`,
          `${String(Math.round(asked.bytes / 1024)).padStart(6)} KB`,
          `${String(Math.round(bytesOnDisk / 1024)).padStart(6)} KB`,
        ].join('  '),
      );

      await app.close();
    } finally {
      rmSync(userDataDir, { recursive: true, force: true });
    }
  }

  console.log('\nentries   launch to readable   asking for it   sent to window   on disk');
  for (const row of rows) console.log(row);
  console.log('');
});
