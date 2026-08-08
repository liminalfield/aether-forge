import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { importPackageFromFile, type RegistryHolder } from './import-package';
import { openRegistry } from './packages';
import { loadedSystems, loadSystems } from './systems';

/** Obviously-dummy Datasworn, for the flow. Nothing from a published book. */
/** A dummy ruleset carrying one move, so an install can be seen to add one. */
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
  moves: {
    doing: {
      contents: {
        try_it: {
          _id: 'move:example_import/doing/try_it',
          type: 'move',
          name: 'Try It',
          roll_type: 'no_roll',
          text: '__When you try it__, do so.',
        },
      },
    },
  },
};

let root: string;
let imported: string;
let holder: RegistryHolder;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'aether-forge-import-'));
  imported = join(root, 'packages');
  mkdirSync(imported);
  holder = { current: await openRegistry({ imported }) };
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const pick = (path: string | undefined) => () => Promise.resolve(path);

describe('importing a package file', () => {
  it('installs a Datasworn file atomically and the listing says so at once', async () => {
    const file = join(root, 'somewhere.json');
    writeFileSync(file, JSON.stringify(A_DUMMY_FILE));

    const asked = await importPackageFromFile(holder, { imported }, pick(file));

    if (!asked.ok) throw new Error(asked.failure.detail);
    expect(asked.value.installedId).toBe('datasworn-community.example_import');
    expect(asked.value.listing.packages.map((box) => box.id)).toEqual([
      'datasworn-community.example_import',
    ]);
    // Installed under its own id, no staging file left behind.
    expect(readdirSync(imported)).toEqual(['datasworn-community.example_import.json']);
    // The unclaimed-ruleset note travels with the answer, not into silence.
    expect(asked.value.notes).toEqual([expect.stringContaining('example_import')]);
  });

  it('installs nothing when the dialog was dismissed, and that is not an error', async () => {
    const asked = await importPackageFromFile(holder, { imported }, pick(undefined));

    if (!asked.ok) throw new Error(asked.failure.detail);
    expect(asked.value.installedId).toBeUndefined();
    expect(readdirSync(imported)).toEqual([]);
  });

  it('refuses a file that is not JSON, as a value, installing nothing', async () => {
    const file = join(root, 'junk.json');
    writeFileSync(file, 'not json at all');

    const asked = await importPackageFromFile(holder, { imported }, pick(file));

    expect(!asked.ok && asked.failure.kind).toBe('unreadable-file');
    expect(readdirSync(imported)).toEqual([]);
  });

  it('refuses JSON that is not a ruleset, naming the refusal', async () => {
    const file = join(root, 'list.json');
    writeFileSync(file, JSON.stringify({ type: 'shopping-list' }));

    const asked = await importPackageFromFile(holder, { imported }, pick(file));

    expect(!asked.ok && asked.failure.kind).toBe('not-a-ruleset');
  });

  it('replaces an installed id, which is what updating a package is', async () => {
    const file = join(root, 'somewhere.json');
    writeFileSync(file, JSON.stringify(A_DUMMY_FILE));
    await importPackageFromFile(holder, { imported }, pick(file));

    const revised = {
      ...A_DUMMY_FILE,
      datasworn_version: '0.3.0',
    };
    writeFileSync(file, JSON.stringify(revised));
    const again = await importPackageFromFile(holder, { imported }, pick(file));

    if (!again.ok) throw new Error(again.failure.detail);
    expect(again.value.listing.packages).toHaveLength(1);
    expect(again.value.listing.packages[0]?.version).toBe('0.3.0');
  });
});

describe('what a person can roll after importing', () => {
  /** Obviously-dummy content, under the ruleset id this build's module claims. */
  const A_CLAIMED_RULESET = {
    ...A_DUMMY_FILE,
    _id: 'starforged',
    title: 'Example Dummy Ruleset Claiming A System',
    oracles: {},
    moves: {
      doing: {
        contents: {
          try_it: {
            _id: 'move:example/doing/try_it',
            type: 'move',
            name: 'Try It',
            roll_type: 'no_roll',
            text: '__When you try it__, do so.',
          },
        },
      },
    },
  };

  const starforgedChecks = () =>
    loadedSystems().find((system) => system.systemId === 'ironsworn-starforged')?.checks ?? [];

  it('offers the new content moves at once, without a restart', async () => {
    // The half-arrival this fixes: tables and the credit appeared straight
    // away, and moves only on the next launch, which is not something a
    // person can explain to themselves.
    loadSystems([]);
    expect(starforgedChecks()).toEqual([]);

    const file = join(root, 'claimed.json');
    writeFileSync(file, JSON.stringify(A_CLAIMED_RULESET));
    const asked = await importPackageFromFile(holder, { imported }, pick(file));

    if (!asked.ok) throw new Error(asked.failure.detail);
    expect(starforgedChecks().map((check) => check.name)).toEqual(['Try It']);
  });
});
