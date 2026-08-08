import { useEffect, useRef, useState } from 'react';

import { Button, KeyHint, Label, labelStyle, slot, tokens } from '@aether-forge/ui';

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
  const searching = useRef<HTMLInputElement>(null);

  // Opening puts the cursor where a person is about to type, and closing
  // forgets what they typed: a palette that reopens holding an old search has
  // answered a question nobody asked twice.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setThrown('');
      setAt(0);
      setFound(null);
      return;
    }
    searching.current?.focus();
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

  if (!open) return null;

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
    <div
      data-testid="oracle-palette"
      role="dialog"
      aria-label="Ask an oracle"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setAt((held) => Math.min(held + 1, tables.length - 1));
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setAt((held) => Math.max(held - 1, 0));
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          consult(chosen);
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: tokens.space[64],
        background: slot('ground', 'void'),
      }}
    >
      <section
        style={{
          width: tokens.layout.palette,
          maxWidth: '90vw',
          display: 'grid',
          gap: tokens.space[12],
          padding: tokens.space[16],
          background: slot('ground', 'raised'),
          border: `${tokens.border.hair} solid ${slot('ink', 'hairline')}`,
          borderRadius: tokens.radius.lg,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Label as="label" htmlFor="oracle-search">
            Ask an oracle
          </Label>
          <span style={labelStyle('line')}>
            <KeyHint>esc to close</KeyHint>
          </span>
        </div>

        <input
          id="oracle-search"
          ref={searching}
          data-testid="oracle-search"
          value={query}
          placeholder="A table, or a group: derelict, planet, ask"
          onChange={(event) => setQuery(event.target.value)}
          style={FIELD}
        />

        {/*
          The list scrolls itself rather than growing. Thirty matches is a lot
          of rows, and a list that grows pushes the die and the button under it
          off the bottom of the window, where nothing can reach them.
        */}
        <ul
          data-testid="oracle-results"
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            maxHeight: tokens.layout.paletteList,
            overflowY: 'auto',
          }}
        >
          {tables.map((table, index) => (
            <li key={table.id}>
              <button
                type="button"
                data-testid="oracle-result"
                aria-current={index === at}
                onClick={() => {
                  setAt(index);
                  consult(table);
                }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: tokens.space[12],
                  width: '100%',
                  textAlign: 'left',
                  padding: `${tokens.space[4]} ${tokens.space[8]}`,
                  border: 'none',
                  borderRadius: tokens.radius.sm,
                  background: index === at ? slot('ground', 'overlay') : 'transparent',
                  color: slot('ink', 'primary'),
                  fontFamily: 'var(--font-ui)',
                  fontSize: tokens.type.compact,
                  cursor: 'pointer',
                }}
              >
                <span>{table.name}</span>
                <span style={labelStyle('line')}>{table.group}</span>
              </button>
            </li>
          ))}

          {tables.length === 0 && (
            <li style={{ ...labelStyle('line'), padding: tokens.space[8] }}>
              Nothing matches that
            </li>
          )}
        </ul>

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
      </section>
    </div>
  );
}
