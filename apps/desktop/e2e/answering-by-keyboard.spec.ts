import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test';

import { launchPackagedApp } from './packaged-app';

/**
 * Answering an offer with the keyboard, where the focused control has to win.
 *
 * This spec exists because it once did not: Enter with the declining chip
 * focused was answered at the card level and accepted the offer, and Escape
 * inside the adjust field threw away what was typed and declined. Every case
 * here is a promise about precedence, pressed for real in the packaged
 * application.
 */

/** Four with a stat of two makes six, which beats one of two and nine. */
const THREW = '4 2 9';

let userDataDir: string;
let app: ElectronApplication;

test.beforeAll(() => {
  userDataDir = mkdtempSync(join(tmpdir(), 'aether-forge-keyboard-'));
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

/**
 * Rolls Face Danger from known dice, and returns the newest card.
 *
 * The campaign accumulates a card per test, and every one of them says "Weak
 * hit", so text cannot tell the new card from the old. Waiting for the count
 * to grow is what identifies it: one roll, one more card, and only then is
 * `last()` the card this test made. Asserted on the count rather than the
 * text because the first version of this helper raced exactly there, and lost.
 */
async function rollACheck(page: Page): Promise<Locator> {
  const before = await page.getByTestId('check-card').count();

  await page.getByTestId('which-check').selectOption({ label: 'Face Danger' });
  await page.getByTestId('input-stat').fill('2');
  await page.getByTestId('thrown').fill(THREW);
  await page.getByTestId('roll-it').click();

  await expect(page.getByTestId('check-card')).toHaveCount(before + 1);
  const card = page.getByTestId('check-card').last();
  await expect(card).toContainText('Weak hit');
  return card;
}

test('Enter on the way out declines, which is what the chip says it does', async () => {
  const page = await open();
  const card = await rollACheck(page);

  await card.getByTestId('just-write').focus();
  await card.getByTestId('just-write').press('Enter');

  await expect(card.getByTestId('settled-offer')).toContainText('refused');
});

test('Enter in the adjust field uses the typed value, and a value that is not a number does nothing', async () => {
  const page = await open();
  const card = await rollACheck(page);
  const field = card.getByTestId('adjust-to');

  // A draft the field will not use is consumed, not passed upward to become
  // an answer nobody gave.
  await field.fill('x');
  await field.press('Enter');
  await expect(card.getByTestId('just-write')).toBeVisible();

  await field.fill('-2');
  await field.press('Enter');

  await expect(card.getByTestId('settled-offer')).toContainText('changed, then taken');
});

test('Escape clears a draft first and declines second', async () => {
  const page = await open();
  const card = await rollACheck(page);
  const field = card.getByTestId('adjust-to');

  await field.fill('5');
  await field.press('Escape');

  // The first press cost the number, not the offer.
  await expect(field).toHaveValue('');
  await expect(card.getByTestId('just-write')).toBeVisible();

  await field.press('Escape');
  await expect(card.getByTestId('settled-offer')).toContainText('refused');
});

test('Enter with the card itself focused takes the leading chip', async () => {
  const page = await open();
  const card = await rollACheck(page);

  await card.focus();
  await expect(card).toBeFocused();
  await card.press('Enter');

  await expect(card.getByTestId('settled-offer')).toContainText('taken');
});
