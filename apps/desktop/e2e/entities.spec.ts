import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test, type ElectronApplication, type Page } from '@playwright/test';

import { launchPackagedApp } from './packaged-app';

/**
 * Entities and tracks in the packaged application, across a restart.
 *
 * The restart is the phase gate: an entity noted mid-session and a track
 * advanced by one have to still be there when the application opens again,
 * because they are events in the campaign log, not state in a window.
 */

let userDataDir: string;
let app: ElectronApplication;

test.beforeAll(() => {
  userDataDir = mkdtempSync(join(tmpdir(), 'aether-forge-entities-'));
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

test('notes a free-form entity and swears a vow from its template', async () => {
  const page = await open();

  // A note: no type, just a name. First-class, not degraded.
  await page.getByTestId('new-entity-name').fill('The indenture');
  await page.getByTestId('note-it').click();
  await expect(page.getByTestId('entity')).toHaveCount(1);

  // A vow, from the module's template: it arrives already carrying its
  // ten-segment progress track, starting empty.
  await page.getByTestId('new-entity-type').selectOption({ label: 'Vow' });
  await page.getByTestId('new-entity-name').fill('Carry the message home');
  await page.getByTestId('note-it').click();
  await expect(page.getByTestId('entity')).toHaveCount(2);

  await page.getByTestId('entity').filter({ hasText: 'Carry the message home' }).click();
  await expect(page.getByTestId('track-progress')).toContainText('0/10');

  // Drawn, not spelled out: progress is something earned, so it is boxes, and
  // anything reading the screen aloud gets the number rather than the shape.
  await expect(page.getByTestId('track-progress')).toHaveAttribute(
    'aria-label',
    'Progress, 0 of 10',
  );
});

test('advances the vow by one, through a button and not a text box', async () => {
  const page = await open();

  await page.getByTestId('entity').filter({ hasText: 'Carry the message home' }).click();
  await expect(page.getByTestId('track-progress')).toContainText('0/10');

  await page.getByTestId('advance-progress').click();
  await expect(page.getByTestId('track-progress')).toContainText('1/10');
});

test('still holds the note, the vow and its progress after the application reopens', async () => {
  const page = await open();

  // The gate. Both were events, so both replay.
  await expect(page.getByTestId('entity')).toHaveCount(2);
  await expect(page.getByTestId('entities-rail')).toContainText('The indenture');

  await page.getByTestId('entity').filter({ hasText: 'Carry the message home' }).click();
  await expect(page.getByTestId('track-progress')).toContainText('1/10');
});

test('changes a field, and the change survives too', async () => {
  const page = await open();

  await page.getByTestId('entity').filter({ hasText: 'Carry the message home' }).click();
  await page.getByTestId('field-rank').fill('formidable');
  await page.getByTestId('field-rank').press('Enter');
  await expect(page.getByTestId('field-rank')).toHaveValue('formidable');

  await app.close();
  const again = await open();
  await again.getByTestId('entity').filter({ hasText: 'Carry the message home' }).click();
  await expect(again.getByTestId('field-rank')).toHaveValue('formidable');
});
