import type { ContentPackage, ProjectionContext, RollPerformedV1 } from '@aether-forge/core';
import { describe, expect, it } from 'vitest';

import type { RegistryHolder } from './import-package';
import { createPackagesProvider } from './oracle-provider';

/** Obviously-dummy content. Nothing here comes from a published book. */
const A_BOX: ContentPackage = {
  manifest: {
    id: 'example.dummy-tables',
    version: '0.4.1',
    title: 'Dummy Tables',
    systems: ['test-system'],
    license: 'CC-BY-4.0',
    source: 'bundled',
    contentHash: 'sha256-irrelevant-here',
  },
  tables: [
    {
      id: 'example.dummy-tables/what-the-silence-holds',
      name: 'What the Silence Holds',
      dice: { sides: 100, count: 1 },
      rows: [
        { from: 1, to: 40, text: 'Nothing that was not already there.' },
        { from: 41, to: 60, text: 'Someone has been here more recently than the dust suggests.' },
        // 61 to 89 deliberately skipped: a gap, as a publisher might write.
        { from: 90, to: 100, text: 'A sound answering yours.' },
      ],
    },
  ],
  documents: [],
  entityTemplates: [],
};

const holder: RegistryHolder = {
  current: { packages: [A_BOX], problems: [] },
};

/**
 * This provider answers from the registry, not the campaign, and passing a
 * context that throws proves it: a provider that started reading campaign
 * state would fail these tests loudly rather than quietly growing a
 * dependency.
 */
const NO_CONTEXT: ProjectionContext = {
  stateOf: () => {
    throw new Error('the installed-packages provider read campaign state it does not need');
  },
};

function aD100Showing(value: number): RollPerformedV1 {
  return {
    request: { dice: [{ sides: 100, count: 1 }] },
    dice: [{ sides: 100, value, source: { kind: 'manual' } }],
  };
}

describe('the installed-packages provider', () => {
  const provider = createPackagesProvider(holder);

  it('resolves a typed-in number to the row it lands on, with the stamp for the event', () => {
    const outcome = provider.resolve(
      'example.dummy-tables/what-the-silence-holds',
      aD100Showing(47),
      NO_CONTEXT,
    );

    if (!outcome.ok) throw new Error(outcome.failure.kind);
    expect(outcome.value.row.text).toContain('more recently');
    expect(outcome.value.row).toEqual(expect.objectContaining({ from: 41, to: 60 }));
    expect(outcome.value.package).toEqual({ id: 'example.dummy-tables', version: '0.4.1' });
  });

  it('answers a table the machine does not hold with a failure, never a guess', () => {
    const outcome = provider.resolve('someone-elses/table', aD100Showing(50), NO_CONTEXT);

    expect(!outcome.ok && outcome.failure.kind).toBe('unknown-table');
  });

  it('answers nothing for a number the table skips, which is the honest reading', () => {
    const outcome = provider.resolve(
      'example.dummy-tables/what-the-silence-holds',
      aD100Showing(75),
      NO_CONTEXT,
    );

    expect(!outcome.ok && outcome.failure).toEqual({
      kind: 'no-row-at',
      tableId: 'example.dummy-tables/what-the-silence-holds',
      landed: 75,
    });
  });

  it('lists every table the machine holds, for the surface that arrives later', () => {
    expect(provider.listTables(NO_CONTEXT).map((table) => table.id)).toEqual([
      'example.dummy-tables/what-the-silence-holds',
    ]);
  });

  it('follows the registry as it stands, not as it stood when the provider was made', () => {
    // The holder is re-read when an import installs. The provider answers
    // from the current reading, so new content is consultable without a
    // restart.
    const changing: RegistryHolder = { current: { packages: [], problems: [] } };
    const later = createPackagesProvider(changing);

    expect(later.listTables(NO_CONTEXT)).toEqual([]);
    changing.current = { packages: [A_BOX], problems: [] };
    expect(later.listTables(NO_CONTEXT)).toHaveLength(1);
  });
});
