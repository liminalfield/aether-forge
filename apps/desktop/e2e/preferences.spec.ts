import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test, type ElectronApplication, type Page } from '@playwright/test';

import { launchPackagedApp } from './packaged-app';

/**
 * The two things a person can change about how the application behaves.
 *
 * The restart is the point for both: a preference that has to be set again
 * every launch is not a preference. The theme is checked by reading a colour
 * off the page rather than a name off a control, because the question is
 * whether the window is actually wearing it.
 */

let userDataDir: string;
let app: ElectronApplication;

test.beforeAll(() => {
  userDataDir = mkdtempSync(join(tmpdir(), 'aether-forge-preferences-'));
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
  await expect(page.getByTestId('preferences')).toBeVisible();
  return page;
}

/** The colour the page is actually painted with, whatever a control says. */
function groundOf(page: Page): Promise<string> {
  return page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--ground-base').trim(),
  );
}

test('opens wearing the reference theme', async () => {
  const page = await open();

  await expect(page.getByTestId('choose-theme')).toHaveValue('Glacial dark');
  expect(await groundOf(page)).toBe('#0E1420');
});

test('changes theme at once, without a restart', async () => {
  const page = await open();

  await page.getByTestId('choose-theme').selectOption('Ember dark');

  // The window is wearing it now, not on the next launch. Nothing that had
  // already rendered was told: the properties simply hold other colours.
  await expect(async () => {
    expect(await groundOf(page)).toBe('#1A1310');
  }).toPass();
});

test('is still wearing it after the application reopens', async () => {
  const page = await open();

  await expect(page.getByTestId('choose-theme')).toHaveValue('Ember dark');
  expect(await groundOf(page)).toBe('#1A1310');
});

test('remembers being asked to hold still', async () => {
  const page = await open();

  await page.getByTestId('choose-motion').selectOption('off');
  await expect(async () => {
    const pulse = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--pulse-ghost').trim(),
    );
    expect(pulse).toBe('none');
  }).toPass();

  await app.close();
  const again = await open();
  await expect(again.getByTestId('choose-motion')).toHaveValue('off');
});
