import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test, type ElectronApplication, type Page } from '@playwright/test';

import { launchPackagedApp } from './packaged-app';

/**
 * Finding a move and reading it, in the packaged application.
 *
 * The reading is the whole point of this surface. The application has held
 * the full text of every move since content packages landed and never shown a
 * word of it.
 */

let userDataDir: string;
let app: ElectronApplication;

test.beforeAll(() => {
  userDataDir = mkdtempSync(join(tmpdir(), 'aether-forge-moves-'));
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
  await expect(page.getByTestId('journal')).toBeVisible();
  return page;
}

async function openThePalette(page: Page): Promise<void> {
  await page.getByTestId('version').click();
  await page.keyboard.press('Control+k');
  await expect(page.getByTestId('move-palette')).toBeVisible();
}

test('finds a move by part of its name', async () => {
  const page = await open();
  await openThePalette(page);

  await page.getByTestId('palette-search').fill('danger');

  // Two of the fifty-four are about facing danger, and both should be here:
  // narrowing is what the search is for, not guessing which one was meant.
  await expect(page.getByTestId('move-result')).toHaveCount(2);
  await expect(page.getByTestId('move-result').first()).toContainText('Face Danger');

  await page.getByTestId('palette-search').fill('danger scene');
  await expect(page.getByTestId('move-result')).toHaveCount(1);
});

test('shows what the move actually says, which is the point of it', async () => {
  const page = await open();
  await openThePalette(page);

  await page.getByTestId('palette-search').fill('begin a session');

  // The words that were imported months ago and never shown once.
  const text = page.getByTestId('move-text');
  await expect(text).toContainText('begin a significant session');
  await expect(text).toContainText('Set a Flag');
});

test('reads the next move as the highlight moves down', async () => {
  const page = await open();
  await openThePalette(page);

  await page.getByTestId('palette-search').fill('vow');
  const first = await page.getByTestId('move-text').textContent();

  await page.keyboard.press('ArrowDown');

  await expect(page.getByTestId('move-text')).not.toHaveText(first ?? '');
});

test('says so when nothing matches, rather than showing an empty box', async () => {
  const page = await open();
  await openThePalette(page);

  await page.getByTestId('palette-search').fill('quixotic');

  await expect(page.getByTestId('move-results')).toContainText('Nothing matches that');
});

test('closes on escape', async () => {
  const page = await open();
  await openThePalette(page);

  await page.keyboard.press('Escape');

  await expect(page.getByTestId('move-palette')).toHaveCount(0);
});
