import type { OracleProvider, OracleTable } from '@aether-forge/core';

import type { IpcResult, OracleSearchView, OracleTableView } from '../shared/ipc';
import type { RegistryHolder } from './import-package';
import { createPackagesProvider } from './oracle-provider';
import { loadedSystems } from './systems';

/**
 * Everything this application can consult, and finding one of it.
 *
 * Providers come from two places. The modules contribute their own, for
 * anything that is a rule rather than content, and one provider reads the
 * tables out of installed content packages. Neither knows about the other.
 *
 * There are 249 tables in one package, in thirteen groups, and more arrive
 * with every package somebody installs. That is why this is a search and not
 * a list: a list is not a way to find something among 249 things.
 *
 * See `design/consulting-an-oracle.md`.
 */

/** How many matches cross at once. Enough to choose from, few enough to read. */
const AT_MOST = 30;

/**
 * The group a table sits in, from its own identifier.
 *
 * An identifier is `<source>/<group…>/<table>`, so the group is what is left
 * after dropping the ends. Underscores become spaces because they are there
 * for machines. A table with no group keeps an empty one rather than
 * borrowing its source's name, which would read as a group that does not
 * exist.
 */
export function groupOf(tableId: string): string {
  const parts = tableId.split('/');
  return parts.slice(1, -1).join(' ').replaceAll('_', ' ');
}

export function everyProvider(holder: RegistryHolder): readonly OracleProvider[] {
  return [
    ...loadedSystems().flatMap((system) => system.oracleProviders),
    createPackagesProvider(holder),
  ];
}

interface Found {
  readonly table: OracleTable;
  readonly provider: string;
}

function everyTable(providers: readonly OracleProvider[]): readonly Found[] {
  return providers.flatMap((provider) =>
    // A provider may answer from campaign state, so it is given the context
    // it was promised. None of the providers this build has needs it.
    provider
      .listTables({
        stateOf: () => {
          throw new Error('listing oracles read campaign state, which nothing here supplies');
        },
      })
      .map((table) => ({ table, provider: provider.id })),
  );
}

function toView(found: Found): OracleTableView {
  return {
    id: found.table.id,
    name: found.table.name,
    group: groupOf(found.table.id),
    provider: found.provider,
    dice: { sides: found.table.dice.sides, count: found.table.dice.count },
  };
}

/**
 * Whether a table answers to what somebody typed.
 *
 * Every word has to match something, anywhere in the name or the group.
 * "derelict" finds the derelict tables even though none is called exactly
 * that, and "derelict access" narrows rather than widening, which is what a
 * person typing two words means by it.
 */
function matches(found: Found, terms: readonly string[]): boolean {
  const haystack = `${found.table.name} ${groupOf(found.table.id)}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

/**
 * What can be consulted, narrowed by what somebody typed.
 *
 * An empty search answers with the first of everything rather than nothing,
 * because a palette that opens empty tells a person nothing about what is in
 * it. The count says how many matched, so a capped answer never reads as a
 * complete one.
 */
export function searchOracles(holder: RegistryHolder, query: unknown): IpcResult<OracleSearchView> {
  const asked = typeof query === 'string' ? query : '';
  const terms = asked
    .toLowerCase()
    .split(/\s+/u)
    .filter((term) => term !== '');

  const all = everyTable(everyProvider(holder));
  const found = terms.length === 0 ? all : all.filter((each) => matches(each, terms));

  return {
    ok: true,
    value: {
      tables: found.slice(0, AT_MOST).map(toView),
      matched: found.length,
    },
  };
}
