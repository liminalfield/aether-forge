import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test, type ElectronApplication, type Page } from '@playwright/test';

import { launchPackagedApp } from './packaged-app';

/**
 * The pre-roll half of assisted but sovereign, in the packaged application.
 *
 * A character exists, so the application reads their strongest stat and puts
 * it in the box with its reasons. The player rolls without typing a stat, and
 * the log records what was suggested and that it was taken; the unit tests on
 * run-check assert the events, this asserts the surface. Typing something
 * else is declining, and needs no ceremony.
 */

let userDataDir: string;
let app: ElectronApplication;

test.beforeAll(() => {
  userDataDir = mkdtempSync(join(tmpdir(), 'aether-forge-suggested-'));
});

test.afterAll(() => {
  rmSync(userDataDir, { recursive: true, force: true });
});

test.afterEach(async () => {
  await app.close();
});

async function open(): Promise<Page> {
  app = await launchPackagedApp(userDataDir);
  const page = await app.firstWindow();
  await expect(page.getByTestId('run-a-check')).toBeVisible();
  return page;
}

test('suggests nothing while the campaign has nobody to read from', async () => {
  const page = await open();

  await page.getByTestId('which-check').selectOption({ label: 'Face Danger' });
  await expect(page.getByTestId('input-stat')).toHaveValue('');
  await expect(page.getByTestId('suggested-stat')).toHaveCount(0);
});

test('reads the stat from a character made a moment ago, and rolls it untyped', async () => {
  const page = await open();

  await page.getByTestId('new-entity-type').selectOption({ label: 'Character' });
  await page.getByTestId('new-entity-name').fill('Vess');
  await page.getByTestId('note-it').click();

  // The box holds the suggestion, and says why, without a restart.
  await page.getByTestId('which-check').selectOption({ label: 'Face Danger' });
  await expect(page.getByTestId('input-stat')).toHaveValue('1');
  await expect(page.getByTestId('suggested-stat')).toContainText('the strongest Vess has');

  // Rolled with dice from the table and no stat typed. Four and one make
  // five, which beats two and not nine.
  await page.getByTestId('thrown').fill('4 2 9');
  await page.getByTestId('roll-it').click();

  const card = page.getByTestId('check-card').last();
  await expect(card).toContainText('Weak hit');
  await expect(card).toContainText('Stat 1');
});
