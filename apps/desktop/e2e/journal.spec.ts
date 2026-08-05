import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { launchPackagedApp } from './packaged-app';

/**
 * Writing to the campaign log from the window, in the packaged application.
 *
 * This is the path everything else is built on: a window with no filesystem
 * access, across the IPC contract, into an append-only database on disk, and
 * back. Tested here rather than in unit tests because every layer has to be
 * real for it to mean anything.
 */

let userDataDir: string;

test.beforeEach(() => {
  userDataDir = mkdtempSync(join(tmpdir(), 'aether-forge-journal-'));
});

test.afterEach(() => {
  rmSync(userDataDir, { recursive: true, force: true });
});

test('a new campaign starts with nothing written', async () => {
  const app = await launchPackagedApp(userDataDir);
  try {
    const page = await app.firstWindow();
    await expect(page.getByText('Nothing written yet.')).toBeVisible();
    await expect(page.getByTestId('entry')).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test('recording an entry writes it to the log', async () => {
  const app = await launchPackagedApp(userDataDir);
  try {
    const page = await app.firstWindow();

    await page.getByLabel('What happened?').fill('The airlock did not open.');
    await page.getByRole('button', { name: 'Record it' }).click();

    // Shown back straight away, from the answer to its own request.
    await expect(page.getByTestId('entry')).toHaveText(['The airlock did not open.']);
    await expect(page.getByLabel('What happened?')).toHaveValue('');
  } finally {
    await app.close();
  }
});

test('refuses an empty entry, and says why', async () => {
  const app = await launchPackagedApp(userDataDir);
  try {
    const page = await app.firstWindow();

    await page.getByLabel('What happened?').fill('   ');
    await page.getByRole('button', { name: 'Record it' }).click();

    await expect(page.getByTestId('problem')).toHaveText('a journal entry cannot be empty');
    await expect(page.getByTestId('entry')).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test('what was written is still there after the application restarts', async () => {
  const first = await launchPackagedApp(userDataDir);
  try {
    const page = await first.firstWindow();
    await page.getByLabel('What happened?').fill('The airlock did not open.');
    await page.getByRole('button', { name: 'Record it' }).click();
    await expect(page.getByTestId('entry')).toHaveCount(1);
  } finally {
    await first.close();
  }

  // Same data directory, new process. Nothing is held in memory across this.
  const second = await launchPackagedApp(userDataDir);
  try {
    const page = await second.firstWindow();
    await expect(page.getByTestId('entry')).toHaveText(['The airlock did not open.']);

    await page.getByLabel('What happened?').fill('It opened on the second try.');
    await page.getByRole('button', { name: 'Record it' }).click();
    await expect(page.getByTestId('entry')).toHaveText([
      'The airlock did not open.',
      'It opened on the second try.',
    ]);
  } finally {
    await second.close();
  }
});

test('the window can ask for the journal and gets what it wrote', async () => {
  const app = await launchPackagedApp(userDataDir);
  try {
    const page = await app.firstWindow();

    await page.getByLabel('What happened?').fill('The airlock did not open.');
    await page.getByRole('button', { name: 'Record it' }).click();
    await expect(page.getByTestId('entry')).toHaveCount(1);

    // Asked over the contract, from the window, in the packaged application.
    // Nothing draws it yet; that is the next task.
    const journal = await page.evaluate(() => window.aetherForge.readJournal());

    expect(journal.ok).toBe(true);
    expect(journal.ok && journal.value.entries).toHaveLength(1);
    expect(journal.ok && journal.value.entries[0]?.text).toBe('The airlock did not open.');
    expect(journal.ok && journal.value.entries[0]?.corrections).toBe(0);
    // What a correction of this entry would supersede.
    expect(journal.ok && journal.value.entries[0]?.currentVersionId).toBe(
      journal.ok ? journal.value.entries[0]?.id : undefined,
    );
  } finally {
    await app.close();
  }
});

test('the journal is still there after the application restarts', async () => {
  const first = await launchPackagedApp(userDataDir);
  try {
    const page = await first.firstWindow();
    await page.getByLabel('What happened?').fill('Written before the restart.');
    await page.getByRole('button', { name: 'Record it' }).click();
    await expect(page.getByTestId('entry')).toHaveCount(1);
  } finally {
    await first.close();
  }

  const second = await launchPackagedApp(userDataDir);
  try {
    const page = await second.firstWindow();
    const journal = await page.evaluate(() => window.aetherForge.readJournal());

    expect(journal.ok && journal.value.entries.map((entry) => entry.text)).toEqual([
      'Written before the restart.',
    ]);
  } finally {
    await second.close();
  }
});

test('shows what was written in the order it was written', async () => {
  const app = await launchPackagedApp(userDataDir);
  try {
    const page = await app.firstWindow();

    for (const text of ['first', 'second', 'third']) {
      await page.getByLabel('What happened?').fill(text);
      await page.getByRole('button', { name: 'Record it' }).click();
      await expect(page.getByLabel('What happened?')).toHaveValue('');
    }

    // Oldest at the top, newest at the bottom. It should read the way it was
    // written, not in reverse.
    await expect(page.getByTestId('entry')).toHaveText(['first', 'second', 'third']);
  } finally {
    await app.close();
  }
});
