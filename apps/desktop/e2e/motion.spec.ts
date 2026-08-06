import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { launchPackagedApp } from './packaged-app';

/**
 * Whether the application moves is a preference, kept with the application
 * rather than in a campaign or a theme.
 *
 * Run against the packaged application because the part worth checking is that
 * the answer survives being closed, which is a file on disk rather than
 * anything in a page.
 */
let userDataDir: string;

test.beforeEach(() => {
  userDataDir = mkdtempSync(join(tmpdir(), 'aether-forge-motion-'));
});

test.afterEach(() => {
  rmSync(userDataDir, { recursive: true, force: true });
});

async function durationsIn(userData: string): Promise<Record<string, string>> {
  const app = await launchPackagedApp(userData);
  try {
    const page = await app.firstWindow();
    await page.waitForFunction(
      () =>
        getComputedStyle(document.documentElement).getPropertyValue('--duration-enter').trim() !==
        '',
    );

    return await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        enter: style.getPropertyValue('--duration-enter').trim(),
        settle: style.getPropertyValue('--duration-settle').trim(),
        ceremony: style.getPropertyValue('--duration-ceremony').trim(),
        easing: style.getPropertyValue('--easing').trim(),
      };
    });
  } finally {
    await app.close();
  }
}

test('the application moves by default', async () => {
  expect(await durationsIn(userDataDir)).toEqual({
    enter: '90ms',
    settle: '140ms',
    ceremony: '260ms',
    easing: 'cubic-bezier(.2,.8,.2,1)',
  });
});

test('turning it off survives a restart', async () => {
  const first = await launchPackagedApp(userDataDir);
  try {
    const page = await first.firstWindow();
    const answer = await page.evaluate(() => window.aetherForge.setMotionPreference('off'));
    expect(answer).toEqual({ ok: true, value: { motion: 'off' } });
  } finally {
    await first.close();
  }

  // The point of the test: a new process, reading what the last one stored.
  expect(await durationsIn(userDataDir)).toEqual({
    enter: '0ms',
    settle: '0ms',
    ceremony: '0ms',
    easing: 'cubic-bezier(.2,.8,.2,1)',
  });
});

test('turning it off removes nothing', async () => {
  const first = await launchPackagedApp(userDataDir);
  try {
    const page = await first.firstWindow();
    await page.evaluate(() => window.aetherForge.setMotionPreference('off'));
  } finally {
    await first.close();
  }

  // Reduced motion means less movement, not less information. Every property a
  // component might ask for is still there, so a moment that deserves marking
  // is still marked; it arrives at once instead of sweeping.
  const still = await durationsIn(userDataDir);
  expect(Object.keys(still).sort()).toEqual(['ceremony', 'easing', 'enter', 'settle']);
  expect(still['easing']).not.toBe('');
});

test('a value nobody declared is refused, and changes nothing', async () => {
  const app = await launchPackagedApp(userDataDir);
  try {
    const page = await app.firstWindow();

    const refused = await page.evaluate(() => window.aetherForge.setMotionPreference('sideways'));
    expect(refused.ok).toBe(false);

    const stored = await page.evaluate(() => window.aetherForge.readPreferences());
    expect(stored).toEqual({ ok: true, value: { motion: 'follow-the-system' } });
  } finally {
    await app.close();
  }
});
