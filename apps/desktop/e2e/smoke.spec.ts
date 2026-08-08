import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test, type ElectronApplication } from '@playwright/test';

import { expectedVersion, launchPackagedApp } from './packaged-app';

/**
 * Smoke test against the **packaged** application.
 *
 * Packaging success only proves electron-builder could wrap the code. It says
 * nothing about whether the window opens, whether the preload bridge attaches,
 * or whether the native module loads from outside the asar. This is the only
 * thing in the pipeline that runs the thing we actually ship.
 */

let app: ElectronApplication;
let userDataDir: string;

test.beforeAll(async () => {
  userDataDir = mkdtempSync(join(tmpdir(), 'aether-forge-smoke-'));
  app = await launchPackagedApp(userDataDir);
});

test.afterAll(async () => {
  await app?.close();
  rmSync(userDataDir, { recursive: true, force: true });
});

test('opens a window titled Aether Forge', async () => {
  const page = await app.firstWindow();
  await expect(page).toHaveTitle('Aether Forge');
});

test('answers app:getVersion over the IPC contract', async () => {
  const page = await app.firstWindow();

  // The renderer has no other way to learn the version: it cannot read
  // package.json and it cannot reach Electron. Seeing the real version on
  // screen proves the whole round trip, preload bridge included. Asserting the
  // exact value rather than any text is what makes this catch a broken handler.
  // Found through its test id rather than its wording, so the design can say it
  // however it likes. The exact value is still asserted, and it still has to
  // have crossed the preload bridge to be on screen at all.
  await expect(page.getByTestId('version')).toHaveText(`v${expectedVersion()}`);
});

test('keeps Node and Electron out of the renderer', async () => {
  const page = await app.firstWindow();

  const exposure = await page.evaluate(() => ({
    require: typeof (globalThis as Record<string, unknown>)['require'],
    process: typeof (globalThis as Record<string, unknown>)['process'],
    api: typeof window.aetherForge?.getAppVersion,
  }));

  // contextIsolation, nodeIntegration and sandbox are load-bearing security
  // decisions taken in the first commit. A regression would be silent, and the
  // packaged build is the only place it is observable.
  expect(exposure.require).toBe('undefined');
  expect(exposure.process).toBe('undefined');
  expect(exposure.api).toBe('function');
});

test('opens its campaign database without crashing', async () => {
  // better-sqlite3 lives outside the asar and is loaded by the main process on
  // startup. If that failed the app would die before painting, so reaching a
  // rendered window at all is the assertion.
  const page = await app.firstWindow();
  await expect(page.locator('#root')).not.toBeEmpty();
});

test('carries the bundled content, credited on screen', async () => {
  // The phase gate for the package registry: the packaged application holds
  // the bundled Starforged package and renders the attribution its license
  // requires, in the window, not behind a menu.
  const page = await app.firstWindow();
  const credits = page.getByTestId('content-credits');
  await expect(credits).toContainText('Shawn Tomkin');
  await expect(credits).toContainText('CC-BY-4.0');
});
