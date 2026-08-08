import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test, type ElectronApplication, type Page } from '@playwright/test';

import { chooseTheMove, openTheMovePalette } from './making-moves';
import { launchPackagedApp } from './packaged-app';

/**
 * Rolling a check in the packaged application, and finding it again afterwards.
 *
 * The dice are typed in rather than rolled, so the outcome is known. That is
 * not a way in for tests: it is the route somebody with dice on their table
 * uses, and it is the only reason this can assert a result at all.
 *
 * The restart is the point. An offer nobody has answered has to still be there
 * when the application opens again, and a refusal has to still say it was
 * refused.
 */

/** Four with a stat of two makes six, which beats one of two and nine. */
const THREW = '4 2 9';

let userDataDir: string;
let app: ElectronApplication;

test.beforeAll(() => {
  userDataDir = mkdtempSync(join(tmpdir(), 'aether-forge-check-'));
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

test('rolls a check from dice a person threw, and refuses what it proposes', async () => {
  const page = await open();

  await openTheMovePalette(page);
  await chooseTheMove(page, 'Face Danger');
  await page.getByTestId('input-stat').fill('2');
  await page.getByTestId('input-bonus').fill('0');
  await page.getByTestId('thrown').fill(THREW);

  // The button says what it is about to do, which is take the dice rather than
  // roll its own.
  await expect(page.getByTestId('roll-it')).toHaveText('Take those dice');
  await page.getByTestId('roll-it').click();

  const card = page.getByTestId('check-card');
  await expect(card).toBeVisible();

  // The outcome those exact dice produce. Asserted as the value it is, because
  // a test that accepted any outcome would pass with the dice ignored.
  await expect(card).toContainText('Weak hit');
  await expect(card).toContainText('4');
  await expect(card).toContainText('2');
  await expect(card).toContainText('9');

  // Where each number came from, said out loud and never behind an expander.
  await expect(card).toContainText('3 thrown');

  // The product's whole position, drawn: anything the application suggests
  // sits in a dashed block, so it cannot be mistaken for something decided.
  const ghost = page.getByTestId('ghost-block');
  await expect(ghost).toBeVisible();
  await expect(ghost).toHaveCSS('border-style', 'dashed');

  // The way out is always there, and it says so.
  await expect(page.getByTestId('just-write')).toBeVisible();
  await page.getByTestId('just-write').click();

  await expect(page.getByTestId('settled-offer')).toContainText('refused');

  // Answered, so it is no longer a suggestion, and the block goes with it.
  await expect(page.getByTestId('ghost-block')).toHaveCount(0);
});

test('still has the card, and the refusal, after the application is opened again', async () => {
  const page = await open();

  const card = page.getByTestId('check-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Face Danger');
  await expect(card).toContainText('Weak hit');
  await expect(page.getByTestId('settled-offer')).toContainText('refused');

  // Refused, so nothing it proposed was written. There is nothing waiting.
  await expect(page.getByTestId('just-write')).toHaveCount(0);
});

test('rolls its own dice when nobody hands any in, and takes what it proposes', async () => {
  const page = await open();

  await openTheMovePalette(page);
  await chooseTheMove(page, 'Face Danger');
  await page.getByTestId('input-stat').fill('3');
  await expect(page.getByTestId('roll-it')).toHaveText('Roll it');
  await page.getByTestId('roll-it').click();

  const cards = page.getByTestId('check-card');
  await expect(cards).toHaveCount(2);

  const newest = cards.last();
  await expect(newest).toContainText('3 rolled');

  await newest.getByTestId('take-it').click();
  await expect(newest.getByTestId('settled-offer')).toContainText('taken');
});

test('writes prose and a check into one campaign, in the order they happened', async () => {
  const page = await open();

  await page.getByLabel('What happened?').fill('The airlock did not open.');
  await page.getByRole('button', { name: 'Record it' }).click();

  await expect(page.getByTestId('entry').last()).toContainText('The airlock did not open.');

  // Two checks and one entry, all in the one journal, which is what a session
  // is. A campaign that kept the rolls somewhere else would be two histories of
  // the same evening.
  await expect(page.getByTestId('check-card')).toHaveCount(2);
  await expect(page.getByTestId('entry')).toHaveCount(1);
});
