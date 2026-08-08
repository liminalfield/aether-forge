import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test, type ElectronApplication, type Page } from '@playwright/test';

import { chooseTheMove, makeAMove, openTheMovePalette } from './making-moves';
import { launchPackagedApp } from './packaged-app';

/**
 * A move with nothing to roll, in the packaged application.
 *
 * Eighteen of the fifty-four Starforged moves have no dice. Every one of them
 * used to offer a roll, a box to type dice into, and a card afterwards saying
 * "It happens as the move says", which was one sentence standing in for all
 * eighteen.
 */

let userDataDir: string;
let app: ElectronApplication;

test.beforeAll(() => {
  userDataDir = mkdtempSync(join(tmpdir(), 'aether-forge-no-dice-'));
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

test('says what its button does, and asks for no dice', async () => {
  const page = await open();

  await openTheMovePalette(page);
  await chooseTheMove(page, 'Begin a Session');

  await expect(page.getByTestId('roll-it')).toHaveText('Do it');
  await expect(page.getByTestId('thrown')).toHaveCount(0);
});

test('records that the move happened, and summarises nothing', async () => {
  const page = await open();

  await makeAMove(page, 'Begin a Session');

  const card = page.getByTestId('check-card').last();
  await expect(card).toContainText('Begin a Session');

  // The move's own text says what happens. A card that paraphrased it badly
  // was worse than a card that says nothing.
  await expect(card.getByTestId('outcome-summary')).toHaveCount(0);
});

test('still offers a roll, and a box for dice, to a move that has them', async () => {
  const page = await open();

  await openTheMovePalette(page);
  await chooseTheMove(page, 'Face Danger');

  await expect(page.getByTestId('roll-it')).toHaveText('Roll it');
  await expect(page.getByTestId('thrown')).toBeVisible();
});
