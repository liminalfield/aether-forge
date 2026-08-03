import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';

/**
 * Smoke test against the **packaged** application.
 *
 * Packaging success only proves electron-builder could wrap the code. It says
 * nothing about whether the window opens, whether the preload bridge attaches,
 * or whether the native module loads from outside the asar. This is the only
 * thing in the pipeline that runs the thing we actually ship.
 *
 * It launches the unpacked build rather than the AppImage or the installer:
 * same asar, same unpacked native modules, same main entry point, without
 * needing FUSE on a runner or silently installing something on a machine.
 */

const appRoot = join(__dirname, '..');

function packagedExecutable(): string {
  const dist = join(appRoot, 'dist');

  if (process.platform === 'linux') {
    // Fixed by electron-builder's linux.executableName.
    return join(dist, 'linux-unpacked', 'aether-forge');
  }

  if (process.platform === 'win32') {
    // Derived from productName, which contains a space, so it is discovered
    // rather than spelled out. A wrong guess here would fail only on Windows,
    // which is the slowest place to find out.
    const unpacked = join(dist, 'win-unpacked');
    const exe = existsSync(unpacked)
      ? readdirSync(unpacked).find((entry) => entry.toLowerCase().endsWith('.exe'))
      : undefined;
    if (!exe) throw new Error(`No .exe found in ${unpacked}`);
    return join(unpacked, exe);
  }

  throw new Error(`No packaged layout is known for platform ${process.platform}`);
}

function expectedVersion(): string {
  const pkg = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8')) as {
    version: string;
  };
  return pkg.version;
}

let app: ElectronApplication;

test.beforeAll(async () => {
  const executablePath = packagedExecutable();

  if (!existsSync(executablePath)) {
    throw new Error(
      `No packaged application at ${executablePath}. ` +
        'Run `pnpm --filter aether-forge-desktop package:dir` first.',
    );
  }

  app = await electron.launch({
    executablePath,
    // Ubuntu restricts unprivileged user namespaces, which Chromium's outer
    // sandbox needs. The renderer keeps sandbox: true in BrowserWindow either
    // way, and the test below is what proves it.
    args: process.env['CI'] ? ['--no-sandbox'] : [],
  });
});

test.afterAll(async () => {
  await app?.close();
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
  await expect(page.getByText(`Version ${expectedVersion()}`)).toBeVisible();
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
