import { readOracleTable } from '@aether-forge/core';
import corpusManifest from '@datasworn-community/starforged/package.json';
import corpus from '@datasworn-community/starforged/json/starforged.json';
import { describe, expect, it } from 'vitest';

import golden from '../goldens/starforged.json';
import { importDatasworn, IMPORTER_OUTPUT_VERSION } from './index.js';

/** The pinned corpus: the fixed input the goldens are generated from. */
function theRealRuleset(): { ruleset: unknown; version: string } {
  return { ruleset: corpus as unknown, version: corpusManifest.version };
}

/**
 * Obviously-dummy Datasworn, for the unit cases. Nothing here comes from a
 * published book.
 */
const A_DUMMY_RULESET = {
  _id: 'example_dummy',
  type: 'ruleset',
  datasworn_version: '0.2.0',
  title: 'Example Dummy Ruleset',
  license: 'https://creativecommons.org/licenses/by/4.0',
  authors: [{ name: 'A. Test Author' }],
  oracles: {
    things: {
      contents: {
        noises: {
          _id: 'oracle_rollable:example_dummy/things/noises',
          type: 'oracle_rollable',
          name: 'Noises',
          dice: '1d10',
          rows: [
            { roll: { min: 1, max: 5 }, text: 'A drip' },
            { roll: { min: 6, max: 10 }, text: 'A hum' },
            { roll: null, text: 'A flavour row nothing lands on' },
          ],
        },
      },
      collections: {
        nested: {
          contents: {
            deeper: {
              _id: 'oracle_rollable:example_dummy/things/nested/deeper',
              type: 'oracle_rollable',
              name: 'Deeper',
              dice: '1d20',
              rows: [{ roll: { min: 1, max: 20 }, text: 'Down' }],
            },
          },
        },
      },
    },
  },
  moves: {
    doing: {
      contents: {
        try_it: {
          _id: 'move:example_dummy/doing/try_it',
          type: 'move',
          name: 'Try It',
          roll_type: 'action_roll',
          text: '__When you try it__, roll.',
          trigger: {
            conditions: [
              { roll_options: [{ using: 'stat', stat: 'poise' }] },
              {
                roll_options: [
                  { using: 'stat', stat: 'verve' },
                  { using: 'stat', stat: 'poise' },
                ],
              },
            ],
          },
          outcomes: {
            strong_hit: { text: 'It works.' },
            weak_hit: { text: 'It works, at a cost.' },
            miss: { text: 'It does not.' },
          },
        },
        ponder: {
          _id: 'move:example_dummy/doing/ponder',
          type: 'move',
          name: 'Ponder',
          roll_type: 'no_roll',
          text: '__When you stop to think__, do so.',
        },
        strange: {
          _id: 'move:example_dummy/doing/strange',
          type: 'move',
          name: 'Strange',
          roll_type: 'a_shape_nobody_knows',
          text: 'Unreadable on purpose.',
        },
      },
    },
  },
};

const OPTIONS = { version: '9.9.9', source: 'imported' as const };

describe('importing a ruleset', () => {
  it('versions its output format', () => {
    expect(IMPORTER_OUTPUT_VERSION).toBe(1);
  });

  it('refuses something that is not a ruleset, as a value', async () => {
    const refused = await importDatasworn({ type: 'shopping-list' }, OPTIONS);
    expect(!refused.ok && refused.failure.kind).toBe('not-a-ruleset');
  });

  it('converts rollables wherever they nest, ids stripped of their kind prefix', async () => {
    const imported = await importDatasworn(A_DUMMY_RULESET, OPTIONS);
    if (!imported.ok) throw new Error(imported.failure.detail);

    expect(imported.value.package.tables.map((table) => table.id)).toEqual([
      'example_dummy/things/noises',
      'example_dummy/things/nested/deeper',
    ]);
    expect(imported.value.package.tables[0]?.dice).toEqual({ sides: 10, count: 1 });
    expect(imported.value.package.tables[0]?.rows[0]).toEqual({
      from: 1,
      to: 5,
      text: 'A drip',
    });
  });

  it('says what it left out instead of hiding it', async () => {
    const imported = await importDatasworn(A_DUMMY_RULESET, OPTIONS);
    if (!imported.ok) throw new Error(imported.failure.detail);

    // The flavour row nothing can land on, the move whose shape the reader
    // has not met, and the unclaimed ruleset id.
    expect(imported.value.problems).toEqual([
      expect.objectContaining({ at: 'example_dummy/things/noises' }),
      expect.objectContaining({ at: 'example_dummy/doing/strange' }),
      expect.objectContaining({ at: 'example_dummy' }),
    ]);
  });

  it('carries each move as a whole document, outcomes included', async () => {
    const imported = await importDatasworn(A_DUMMY_RULESET, OPTIONS);
    if (!imported.ok) throw new Error(imported.failure.detail);

    const tryIt = imported.value.package.documents.find(
      (doc) => doc.id === 'example_dummy/doing/try_it',
    );
    expect(tryIt?.title).toBe('Try It');
    expect(tryIt?.text).toContain('__When you try it__');
    expect(tryIt?.text).toContain('**On a weak hit:** It works, at a cost.');
  });

  it('puts structured move facts in the compartment, stats deduplicated in source order', async () => {
    const imported = await importDatasworn(A_DUMMY_RULESET, OPTIONS);
    if (!imported.ok) throw new Error(imported.failure.detail);

    const raw = imported.value.package.raw as {
      formatVersion: number;
      moves: readonly { id: string; name: string; kind: string; stats: readonly string[] }[];
    };
    expect(raw.formatVersion).toBe(1);
    expect(raw.moves).toEqual([
      {
        id: 'example_dummy/doing/try_it',
        name: 'Try It',
        kind: 'action',
        stats: ['poise', 'verve'],
      },
      { id: 'example_dummy/doing/ponder', name: 'Ponder', kind: 'none', stats: [] },
    ]);
  });

  it('carries the license as SPDX and the attribution as text', async () => {
    const imported = await importDatasworn(A_DUMMY_RULESET, OPTIONS);
    if (!imported.ok) throw new Error(imported.failure.detail);

    expect(imported.value.package.manifest.license).toBe('CC-BY-4.0');
    expect(imported.value.package.manifest.attribution).toBe(
      'Example Dummy Ruleset is by A. Test Author, used under CC-BY-4.0.',
    );
  });

  it('hashes the same content the same, and different content differently', async () => {
    const once = await importDatasworn(A_DUMMY_RULESET, OPTIONS);
    const again = await importDatasworn(A_DUMMY_RULESET, OPTIONS);
    const other = await importDatasworn(
      {
        ...A_DUMMY_RULESET,
        oracles: {},
      },
      OPTIONS,
    );

    if (!once.ok || !again.ok || !other.ok) throw new Error('the fixture failed to import');
    expect(once.value.package.manifest.contentHash).toBe(again.value.package.manifest.contentHash);
    expect(once.value.package.manifest.contentHash).not.toBe(
      other.value.package.manifest.contentHash,
    );
  });
});

describe('the goldens, which are the specification', () => {
  it('converts the pinned corpus to exactly the checked-in golden', async () => {
    const { ruleset, version } = theRealRuleset();
    const imported = await importDatasworn(ruleset, { version, source: 'bundled' });
    if (!imported.ok) throw new Error(imported.failure.detail);

    // A failure here is either a regression or a deliberate content-model
    // change. If it is deliberate, regenerate with `pnpm generate:goldens`
    // and review the diff in the same pull request.
    expect(JSON.parse(JSON.stringify(imported.value))).toEqual(golden);
  });

  it('produces tables core itself can read, every one of them', async () => {
    const { ruleset, version } = theRealRuleset();
    const imported = await importDatasworn(ruleset, { version, source: 'bundled' });
    if (!imported.ok) throw new Error(imported.failure.detail);

    for (const table of imported.value.package.tables) {
      expect(readOracleTable(table)).toBeDefined();
    }
    expect(imported.value.package.tables.length).toBeGreaterThan(200);
  });

  it('carries the whole move list, and knows one it never hand-wrote', async () => {
    const { ruleset, version } = theRealRuleset();
    const imported = await importDatasworn(ruleset, { version, source: 'bundled' });
    if (!imported.ok) throw new Error(imported.failure.detail);

    const raw = imported.value.package.raw as {
      moves: readonly { id: string; kind: string; stats: readonly string[] }[];
    };
    expect(raw.moves.length).toBe(56);
    expect(imported.value.package.documents.length).toBe(56);

    const faceDanger = raw.moves.find((move) => move.id === 'starforged/adventure/face_danger');
    expect(faceDanger?.kind).toBe('action');
    expect(faceDanger?.stats).toEqual(['edge', 'heart', 'iron', 'shadow', 'wits']);

    const secureAnAdvantage = raw.moves.find(
      (move) => move.id === 'starforged/adventure/secure_an_advantage',
    );
    expect(secureAnAdvantage?.kind).toBe('action');
  });

  it('lands the corpus at the rows the book prints', async () => {
    const { ruleset, version } = theRealRuleset();
    const imported = await importDatasworn(ruleset, { version, source: 'bundled' });
    if (!imported.ok) throw new Error(imported.failure.detail);

    const action = imported.value.package.tables.find(
      (table) => table.id === 'starforged/core/action',
    );
    expect(action?.rows[0]).toEqual({ from: 1, to: 1, text: 'Abandon' });
    expect(action?.dice).toEqual({ sides: 100, count: 1 });
  });
});
