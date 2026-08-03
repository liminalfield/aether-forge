import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { _electron as electron, type ElectronApplication } from '@playwright/test';

/**
 * Launching the packaged application for tests.
 *
 * Shared by the smoke tests and the journal tests, because both need the same
 * thing: the real built application, with its own data directory so that runs
 * cannot see each other's campaigns.
 */

const appRoot = join(__dirname, '..');

export function packagedExecutable(): string {
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

export function expectedVersion(): string {
  const pkg = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8')) as {
    version: string;
  };
  return pkg.version;
}

/**
 * @param userDataDir Where the application should keep its campaigns. Given a
 *   directory of its own, a test cannot see anything left behind by an earlier
 *   run, and a test that restarts the application can point both launches at
 *   the same place on purpose.
 */
export async function launchPackagedApp(userDataDir: string): Promise<ElectronApplication> {
  const executablePath = packagedExecutable();

  if (!existsSync(executablePath)) {
    throw new Error(
      `No packaged application at ${executablePath}. ` +
        'Run `pnpm --filter aether-forge-desktop package:dir` first.',
    );
  }

  return electron.launch({
    executablePath,
    args: [
      `--user-data-dir=${userDataDir}`,
      // Ubuntu restricts unprivileged user namespaces, which Chromium's outer
      // sandbox needs. The renderer keeps sandbox: true in BrowserWindow either
      // way, and the smoke test is what proves it.
      ...(process.env['CI'] ? ['--no-sandbox'] : []),
    ],
  });
}
