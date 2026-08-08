import type { ContentPackage } from '@aether-forge/core';
import { describe, expect, it } from 'vitest';

import { loadFixtureSystems } from './content-fixture';
import type { RegistryHolder } from './import-package';
import { everyProvider, groupOf, searchOracles } from './oracles';

loadFixtureSystems();

/** Obviously-dummy content. Nothing here comes from a published table. */
function aTable(id: string, name: string) {
  return {
    id,
    name,
    dice: { sides: 100, count: 1 },
    rows: [{ from: 1, to: 100, text: 'Something' }],
  };
}

const A_BOX: ContentPackage = {
  manifest: {
    id: 'example.dummy-tables',
    version: '0.4.1',
    title: 'Dummy Tables',
    systems: ['ironsworn-starforged'],
    license: 'CC-BY-4.0',
    source: 'bundled',
    contentHash: 'sha256-irrelevant-here',
  },
  tables: [
    aTable('example/derelict/access', 'Access'),
    aTable('example/derelict/inner_first_look', 'Inner First Look'),
    aTable('example/planet/desert/name', 'Desert Name'),
    aTable('example/core/action', 'Action'),
    aTable('nogroup', 'No Group At All'),
  ],
  documents: [],
  entityTemplates: [],
};

const holder: RegistryHolder = { current: { packages: [A_BOX], problems: [] } };
const empty: RegistryHolder = { current: { packages: [], problems: [] } };

function found(query: string, over: RegistryHolder = holder): readonly string[] {
  const answer = searchOracles(over, query);
  if (!answer.ok) throw new Error('searching cannot fail');
  return answer.value.tables.map((table) => table.name);
}

describe('the group a table sits in', () => {
  it('is what is left after dropping the source and the table', () => {
    expect(groupOf('example/derelict/access')).toBe('derelict');
    expect(groupOf('example/planet/desert/name')).toBe('planet desert');
  });

  it('turns underscores into spaces, because they are there for machines', () => {
    expect(groupOf('example/location_theme/feature')).toBe('location theme');
  });

  it('is empty for a table with no group, rather than borrowing its source', () => {
    // Borrowing would read as a group that does not exist.
    expect(groupOf('nogroup')).toBe('');
  });
});

describe('what can be consulted', () => {
  it('gathers the modules own oracles and the ones in installed packages', () => {
    const providers = everyProvider(holder).map((provider) => provider.id);

    expect(providers).toContain('ironsworn-starforged-ask');
    expect(providers).toContain('installed-packages');
  });

  it('still works when no package is installed, offering what the modules answer', () => {
    // The five ways of asking are rules and need no content at all.
    expect(found('', empty)).toContain('Likely');
  });
});

describe('finding one', () => {
  it('matches a group even when no table is called that', () => {
    // The point of matching the group as well: nothing is called Derelict.
    expect(found('derelict')).toEqual(['Access', 'Inner First Look']);
  });

  it('matches a name', () => {
    expect(found('desert')).toEqual(['Desert Name']);
  });

  it('narrows on a second word rather than widening', () => {
    // Two words is what a person means by narrowing.
    expect(found('derelict access')).toEqual(['Access']);
  });

  it('ignores case, because nobody types a table name the way it is stored', () => {
    expect(found('ACCESS')).toEqual(['Access']);
  });

  it('answers with the first of everything when nothing has been typed', () => {
    // A palette that opens empty tells a person nothing about what is in it.
    expect(found('').length).toBeGreaterThan(0);
  });

  it('finds the yes-or-no oracles by what a person would call them', () => {
    expect(found('likely')).toContain('Likely');
    expect(found('ask')).toContain('Fifty fifty');
  });

  it('answers nothing for something nothing matches, rather than everything', () => {
    expect(found('quixotic')).toEqual([]);
  });
});

describe('how much crosses at once', () => {
  it('caps what it sends and says how many matched, so a capped answer is never mistaken for all of them', () => {
    const many: ContentPackage = {
      ...A_BOX,
      tables: Array.from({ length: 80 }, (_unused, at) =>
        aTable(`example/many/table_${String(at)}`, `Many ${String(at)}`),
      ),
    };
    const over: RegistryHolder = { current: { packages: [many], problems: [] } };

    const answer = searchOracles(over, 'many');
    if (!answer.ok) throw new Error('searching cannot fail');

    expect(answer.value.tables).toHaveLength(30);
    expect(answer.value.matched).toBe(80);
  });
});
