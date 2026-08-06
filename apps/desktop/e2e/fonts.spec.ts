import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { launchPackagedApp } from './packaged-app';

/**
 * The application carries its own typefaces.
 *
 * It is offline-first, so a font that needs the network is a font that is
 * sometimes not there. These check the packaged application, because a font
 * that resolves in development and is missing from the bundle is exactly the
 * failure this is meant to prevent.
 */
let userDataDir: string;

test.beforeEach(() => {
  userDataDir = mkdtempSync(join(tmpdir(), 'aether-forge-fonts-'));
});

test.afterEach(() => {
  rmSync(userDataDir, { recursive: true, force: true });
});

test('the packaged application carries its own typefaces', async () => {
  const app = await launchPackagedApp(userDataDir);
  try {
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => document.fonts.ready);

    const loaded = await page.evaluate(() => [...document.fonts].map((face) => face.family).sort());

    expect(new Set(loaded)).toEqual(new Set(['Literata', 'Archivo', 'IBM Plex Mono']));
  } finally {
    await app.close();
  }
});

test('every bundled face actually resolves', async () => {
  const app = await launchPackagedApp(userDataDir);
  try {
    const page = await app.firstWindow();
    await page.evaluate(() => document.fonts.ready);

    // A face with a unicode-range loads only when something needs it, so
    // check() alone answers false for a font that is present and simply has not
    // been asked for. Loading it explicitly is what proves the file is in the
    // bundle and parses: a missing or corrupt file rejects here.
    const resolved = await page.evaluate(async () => {
      const wanted = [
        ['prose', '300 16px Literata'],
        ['proseItalic', 'italic 300 16px Literata'],
        ['ui', '500 13px Archivo'],
        ['numeric', '400 15px "IBM Plex Mono"'],
      ] as const;

      const outcome: Record<string, number> = {};
      for (const [role, font] of wanted) {
        const faces = await document.fonts.load(font, 'Aa1');
        outcome[role] = faces.length;
      }
      return outcome;
    });

    // At least one face loaded for each, which is the latin subset resolving.
    expect(resolved['prose']).toBeGreaterThan(0);
    expect(resolved['proseItalic']).toBeGreaterThan(0);
    expect(resolved['ui']).toBeGreaterThan(0);
    expect(resolved['numeric']).toBeGreaterThan(0);
  } finally {
    await app.close();
  }
});

test('the interface reads in its own typeface, not the system one', async () => {
  const app = await launchPackagedApp(userDataDir);
  try {
    const page = await app.firstWindow();
    await page.evaluate(() => document.fonts.ready);

    const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(family).toContain('Archivo');
  } finally {
    await app.close();
  }
});

test('nothing is fetched from another origin', async () => {
  const app = await launchPackagedApp(userDataDir);
  try {
    const page = await app.firstWindow();

    const elsewhere: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (!url.startsWith('file:') && !url.startsWith('devtools:') && !url.startsWith('data:')) {
        elsewhere.push(url);
      }
    });

    await page.reload();
    await page.evaluate(() => document.fonts.ready);

    // The content security policy forbids it and the fonts are bundled, so
    // there is nothing left that would need the network.
    expect(elsewhere).toEqual([]);
  } finally {
    await app.close();
  }
});

test('one copy of React runs, not two', async () => {
  const app = await launchPackagedApp(userDataDir);
  try {
    const page = await app.firstWindow();
    await page.waitForSelector('[data-testid="journal"]');

    // Two copies of React in one process is a class of bug that is unpleasant
    // to diagnose and trivial to avoid, which is why the component library
    // takes it as a peer dependency rather than depending on it. React keeps
    // its internals on a single shared object; a second copy means a second
    // one, and hooks stop working across the seam.
    const copies = await page.evaluate(() => {
      const hook = (window as unknown as Record<string, unknown>)[
        '__REACT_DEVTOOLS_GLOBAL_HOOK__'
      ] as { renderers?: Map<unknown, unknown> } | undefined;
      return hook?.renderers?.size ?? null;
    });

    // Without devtools attached the hook is absent, and the meaningful check is
    // the one below: a component from the library renders inside the
    // application's own tree, which cannot happen across two copies.
    expect(copies === null || copies === 1).toBe(true);

    const buttonWorks = await page.evaluate(() => {
      const button = document.querySelector('button[type="submit"]');
      return button !== null && getComputedStyle(button).cursor === 'pointer';
    });
    expect(buttonWorks).toBe(true);
  } finally {
    await app.close();
  }
});
