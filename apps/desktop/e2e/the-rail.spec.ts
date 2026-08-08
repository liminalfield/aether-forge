import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test, type ElectronApplication, type Page } from '@playwright/test';

import { launchPackagedApp } from './packaged-app';

/**
 * The campaign beside the writing.
 *
 * What a person is playing should be readable without opening anything and
 * without leaving the page they are writing on. The restart is the point of
 * the last one: entities are events, so what is in the rail is not a view
 * that has to be rebuilt by hand.
 */

let userDataDir: string;
let app: ElectronApplication;

test.beforeAll(() => {
  userDataDir = mkdtempSync(join(tmpdir(), 'aether-forge-rail-'));
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
  await expect(page.getByTestId('entities-rail')).toBeVisible();
  return page;
}

test('shows a character with stats and meters, without opening anything', async () => {
  const page = await open();

  await page.getByTestId('new-entity-type').selectOption({ label: 'Character' });
  await page.getByTestId('new-entity-name').fill('Vess');
  await page.getByTestId('note-it').click();

  const rail = page.getByTestId('entities-rail');
  await expect(rail).toContainText('Vess');

  // Readable at a glance: the five stats and the three condition meters, with
  // nothing clicked.
  await expect(page.getByTestId('stat-edge')).toContainText('1');
  await expect(page.getByTestId('summary-health')).toContainText('5/5');
  await expect(page.getByTestId('summary-supply')).toContainText('5/5');
});

test('puts the character above the vows, in the order the module describes them', async () => {
  const page = await open();

  await page.getByTestId('new-entity-type').selectOption({ label: 'Vow' });
  await page.getByTestId('new-entity-name').fill('Carry the message');
  await page.getByTestId('note-it').click();

  // The window does not know what a character is. It puts the groups in the
  // order the modules gave them, and the module declares a character first.
  const headings = await page.getByTestId('entities-rail').locator('h2').allTextContents();
  expect(headings).toEqual(['Character', 'Vow']);
});

test('draws a vow as boxes and a meter as a bar, because the shapes mean different things', async () => {
  const page = await open();

  await expect(page.getByTestId('summary-progress')).toContainText('0/10');
  await expect(page.getByTestId('summary-progress')).toHaveAttribute(
    'aria-label',
    'Progress, 0 of 10',
  );
});

test('is still there after the application reopens', async () => {
  const page = await open();

  await expect(page.getByTestId('stat-edge')).toContainText('1');
  await expect(page.getByTestId('summary-progress')).toContainText('0/10');
});
