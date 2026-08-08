import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test, type ElectronApplication, type Page } from '@playwright/test';

import { launchPackagedApp } from './packaged-app';

/**
 * The move list, arrived as content, in the packaged application.
 *
 * The phase gate: a move nobody ever hand-wrote runs end to end, because it
 * is a row of content joined to an interpreter. Face Danger still runs too,
 * now built the same way.
 */

let userDataDir: string;
let app: ElectronApplication;

test.beforeAll(() => {
  userDataDir = mkdtempSync(join(tmpdir(), 'aether-forge-content-moves-'));
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

test('rolls a move that was never hand-written, from the bundled content', async () => {
  const page = await open();

  await page.getByTestId('which-check').selectOption({ label: 'Secure an Advantage' });
  await page.getByTestId('input-stat').fill('2');
  await page.getByTestId('thrown').fill('4 2 9');
  await page.getByTestId('roll-it').click();

  const card = page.getByTestId('check-card').last();
  await expect(card).toContainText('Secure an Advantage');
  await expect(card).toContainText('Weak hit');
});

test('offers the whole move list, not a hand-written handful', async () => {
  const page = await open();

  const options = page.getByTestId('which-check').locator('option');
  // 31 action, 5 progress and 18 no-roll moves; the two special-track moves
  // offer no check yet, honestly.
  await expect(options).toHaveCount(54);
});

test('still proposes momentum on Face Danger, which is the tuned move', async () => {
  const page = await open();

  await page.getByTestId('which-check').selectOption({ label: 'Face Danger' });
  await page.getByTestId('input-stat').fill('2');
  await page.getByTestId('thrown').fill('4 2 9');
  await page.getByTestId('roll-it').click();

  const card = page.getByTestId('check-card').last();
  await expect(card).toContainText('Weak hit');
  await expect(card.getByTestId('just-write')).toBeVisible();
});
