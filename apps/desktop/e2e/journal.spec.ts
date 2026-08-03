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

test('a new campaign starts with nothing recorded', async () => {
  const app = await launchPackagedApp(userDataDir);
  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId('event-count')).toHaveText('0 events recorded');
  } finally {
    await app.close();
  }
});

test('recording an entry writes it to the log', async () => {
  const app = await launchPackagedApp(userDataDir);
  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId('event-count')).toHaveText('0 events recorded');

    await page.getByLabel('What happened?').fill('The airlock did not open.');
    await page.getByRole('button', { name: 'Record it' }).click();

    await expect(page.getByTestId('event-count')).toHaveText('1 events recorded');
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
    await expect(page.getByTestId('event-count')).toHaveText('0 events recorded');
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
    await expect(page.getByTestId('event-count')).toHaveText('1 events recorded');
  } finally {
    await first.close();
  }

  // Same data directory, new process. Nothing is held in memory across this.
  const second = await launchPackagedApp(userDataDir);
  try {
    const page = await second.firstWindow();
    await expect(page.getByTestId('event-count')).toHaveText('1 events recorded');

    await page.getByLabel('What happened?').fill('It opened on the second try.');
    await page.getByRole('button', { name: 'Record it' }).click();
    await expect(page.getByTestId('event-count')).toHaveText('2 events recorded');
  } finally {
    await second.close();
  }
});
