import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test, type ElectronApplication, type Page } from '@playwright/test';

import { launchPackagedApp } from './packaged-app';

/**
 * Importing content at runtime, in the packaged application.
 *
 * The native file dialog cannot be driven from a test, so the main process's
 * dialog is stubbed to answer with a fixture path: everything after the
 * dialog, which is everything worth testing, runs for real. The fixture is
 * obviously-dummy Datasworn; nothing from a published book.
 */

const A_DUMMY_FILE = {
  _id: 'example_import',
  type: 'ruleset',
  datasworn_version: '0.2.0',
  title: 'Example Imported Ruleset',
  license: 'https://creativecommons.org/licenses/by/4.0',
  authors: [{ name: 'A. Test Author' }],
  oracles: {
    things: {
      contents: {
        noises: {
          _id: 'oracle_rollable:example_import/things/noises',
          type: 'oracle_rollable',
          name: 'Noises',
          dice: '1d10',
          rows: [{ roll: { min: 1, max: 10 }, text: 'A hum' }],
        },
      },
    },
  },
  moves: {},
};

let userDataDir: string;
let fixtureDir: string;
let app: ElectronApplication;

test.beforeAll(() => {
  userDataDir = mkdtempSync(join(tmpdir(), 'aether-forge-import-e2e-'));
  fixtureDir = mkdtempSync(join(tmpdir(), 'aether-forge-import-fixture-'));
  writeFileSync(join(fixtureDir, 'dummy.json'), JSON.stringify(A_DUMMY_FILE));
});

test.afterAll(() => {
  rmSync(userDataDir, { recursive: true, force: true });
  rmSync(fixtureDir, { recursive: true, force: true });
});

test.afterEach(async () => {
  await app.close();
});

async function open(): Promise<Page> {
  app = await launchPackagedApp(userDataDir);
  const page = await app.firstWindow();
  await expect(page.getByTestId('content-credits')).toBeVisible();
  return page;
}

test('imports a Datasworn file and credits it beside the bundled content', async () => {
  const page = await open();

  await app.evaluate(
    ({ dialog }, path) => {
      dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [path] });
    },
    join(fixtureDir, 'dummy.json'),
  );

  await page.getByTestId('import-content').click();

  const credits = page.getByTestId('content-credits');
  await expect(credits).toContainText('A. Test Author');
  await expect(credits).toContainText('Shawn Tomkin');
});

test('still holds the imported package after the application reopens', async () => {
  const page = await open();

  await expect(page.getByTestId('content-credits')).toContainText('A. Test Author');
});
