import { useEffect, useState } from 'react';

import {
  Button,
  Label,
  labelStyle,
  Palette,
  PaletteList,
  PaletteRow,
  slot,
  tokens,
} from '@aether-forge/ui';

import type { OracleSearchView, OracleTableView } from '../shared/ipc';

/**
 * Asking an oracle, from wherever you were writing.
 *
 * A box over the page rather than a panel beside it. You are in the middle of
 * a sentence when you want to know something, and a surface you have to go to
 * is a surface you stop writing to use.
 *
 * A search and not a list, because there are hundreds of tables. Every word
 * matches against a table's name and the group it sits in, so "derelict"
 * finds the derelict tables and "ask likely" finds the way of asking whether
 * something likely is so.
 *
 * The die is optional. Leave the box empty and the application rolls; type in
 * what you threw and it takes that. Everything downstream is identical, which
 * is why there is no second path for it here.
 *
 * See `design/consulting-an-oracle.md`.
 */

const FIELD = {
  background: slot('ground', 'raised'),
  color: slot('ink', 'primary'),
  border: `${tokens.border.hair} solid ${slot('ink', 'hairline')}`,
  borderRadius: tokens.radius.sm,
  padding: `${tokens.space[8]} ${tokens.space[12]}`,
  fontFamily: 'var(--font-ui)',
  fontSize: tokens.type.compact,
} as const;

export interface OraclePaletteProps {
  readonly open: boolean;
  readonly busy: boolean;
  readonly onSearch: (query: string) => Promise<OracleSearchView>;
  readonly onConsult: (tableId: string, thrown: readonly number[] | undefined) => void;
  readonly onClose: () => void;
}

export function OraclePalette({
  open,
  busy,
  onSearch,
  onConsult,
  onClose,
}: OraclePaletteProps): React.JSX.Element | null {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<OracleSearchView | null>(null);
  const [at, setAt] = useState(0);
  const [thrown, setThrown] = useState('');

  // Closing forgets what was typed: a palette that reopens holding an old
  // search has answered a question nobody asked twice. Opening puts the
  // cursor in the search, which the frame does.
  useEffect(() => {
    if (open) return;
    setQuery('');
    setThrown('');
    setAt(0);
    setFound(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let current = true;
    void onSearch(query).then((answer) => {
      if (!current) return;
      setFound(answer);
      setAt(0);
    });
    return () => {
      current = false;
    };
  }, [open, query, onSearch]);

  const tables: readonly OracleTableView[] = found?.tables ?? [];
  const chosen = tables[Math.min(at, tables.length - 1)];

  const consult = (table: OracleTableView | undefined): void => {
    if (table === undefined || busy) return;

    const numbers = thrown
      .split(/[\s,]+/u)
      .filter((each) => each !== '')
      .map(Number);
    const wanted = table.dice.count;

    onConsult(table.id, numbers.length === wanted && wanted > 0 ? numbers : undefined);
  };

  return (
    <Palette
      data-testid="oracle-palette"
      open={open}
      title="Ask an oracle"
      placeholder="A table, or a group: derelict, planet, ask"
      query={query}
      onQuery={setQuery}
      count={tables.length}
      at={at}
      onAt={setAt}
      onChoose={() => consult(chosen)}
      onClose={onClose}
    >
      <PaletteList data-testid="oracle-results">
        {tables.map((table, index) => (
          <li key={table.id}>
            <PaletteRow
              data-testid="oracle-result"
              chosen={index === at}
              aside={table.group}
              onClick={() => {
                setAt(index);
                consult(table);
              }}
            >
              {table.name}
            </PaletteRow>
          </li>
        ))}

        {tables.length === 0 && (
          <li style={{ ...labelStyle('line'), padding: tokens.space[8] }}>Nothing matches that</li>
        )}
      </PaletteList>

      {/*
        How many matched, when more matched than crossed. A capped list that
        says nothing reads as a complete one.
      */}
      {found !== null && found.matched > tables.length && (
        <Label size="line" as="p" data-testid="oracle-more">
          {found.matched} match. Showing the first {tables.length}.
        </Label>
      )}

      <div style={{ display: 'flex', gap: tokens.space[8], alignItems: 'center' }}>
        <Label as="label" htmlFor="oracle-thrown">
          Dice you threw
        </Label>
        <input
          id="oracle-thrown"
          data-testid="oracle-thrown"
          value={thrown}
          placeholder="leave it empty to roll"
          onChange={(event) => setThrown(event.target.value)}
          style={{ ...FIELD, width: '18ch' }}
        />
        <Button
          data-testid="oracle-consult"
          disabled={busy || chosen === undefined}
          onClick={() => consult(chosen)}
        >
          {thrown.trim() === '' ? 'Roll it' : 'Take that'}
        </Button>
      </div>
    </Palette>
  );
}
