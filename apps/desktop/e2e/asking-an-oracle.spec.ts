import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test, type ElectronApplication, type Page } from '@playwright/test';

import { launchPackagedApp } from './packaged-app';

/**
 * Asking an oracle in the packaged application.
 *
 * The two kinds of asking, both from the same palette and both landing in the
 * journal. The restart is the point of the last one: an answer is an event, so
 * it is still there.
 */

let userDataDir: string;
let app: ElectronApplication;

test.beforeAll(() => {
  userDataDir = mkdtempSync(join(tmpdir(), 'aether-forge-oracle-'));
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

/**
 * Opens the palette the way a person does, with the key.
 *
 * Focus goes to the title bar first, which is never a field. Clicking the
 * page itself lands wherever the journal has scrolled to, which is sometimes
 * the writing box, and the key is deliberately ignored while somebody is
 * typing into one. The title bar is reached by its own test id, because every
 * result card has a header too.
 */
async function openThePalette(page: Page): Promise<void> {
  await page.getByTestId('version').click();
  await page.keyboard.press('Control+o');
  await expect(page.getByTestId('oracle-palette')).toBeVisible();
}

test('asks whether something likely is so, and the answer lands in the journal', async () => {
  const page = await open();
  await openThePalette(page);

  // The five ways of asking are the module's own, and need no content.
  await page.getByTestId('oracle-search').fill('likely');
  await expect(page.getByTestId('oracle-result').first()).toContainText('Likely');

  // Forty against a line at 75 is yes, and typing the die in is the ordinary
  // route rather than a way in for tests.
  await page.getByTestId('oracle-thrown').fill('40');
  await page.getByTestId('oracle-consult').click();

  await expect(page.getByTestId('oracle-palette')).toHaveCount(0);
  const card = page.getByTestId('consultation-card').last();
  await expect(card).toContainText('Likely');
  await expect(card.getByTestId('oracle-answer')).toHaveText('Yes');
});

test('finds a real table by searching for its group, and consults it', async () => {
  const page = await open();
  await openThePalette(page);

  // Nothing in the bundled content is called Derelict. Matching the group is
  // what finds it.
  await page.getByTestId('oracle-search').fill('derelict');
  await expect(page.getByTestId('oracle-result').first()).toBeVisible();

  await page.getByTestId('oracle-thrown').fill('47');
  await page.getByTestId('oracle-consult').click();

  const card = page.getByTestId('consultation-card').last();
  await expect(card.getByTestId('oracle-answer')).not.toHaveText('');
  // The range the number landed in, which is how a person can tell later
  // whether the table moved underneath them.
  await expect(card.getByTestId('oracle-row')).toContainText('–');
});

test('says how many matched when more matched than it showed', async () => {
  const page = await open();
  await openThePalette(page);

  await page.getByTestId('oracle-search').fill('a');

  // A capped list that says nothing reads as a complete one.
  await expect(page.getByTestId('oracle-more')).toContainText('Showing the first');
});

test('closes on escape without asking anything', async () => {
  const page = await open();
  await openThePalette(page);

  const before = await page.getByTestId('consultation-card').count();
  await page.keyboard.press('Escape');

  await expect(page.getByTestId('oracle-palette')).toHaveCount(0);
  await expect(page.getByTestId('consultation-card')).toHaveCount(before);
});

test('still holds both answers after the application reopens', async () => {
  const page = await open();

  // Answers are events, so they replay.
  await expect(page.getByTestId('consultation-card')).toHaveCount(2);
  await expect(page.getByTestId('consultation-card').first()).toContainText('Likely');
});
