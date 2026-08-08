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

import type { CheckView, ReferenceDocView, RunCheckRequest } from '../shared/ipc';

const FIELD = {
  background: slot('ground', 'raised'),
  color: slot('ink', 'primary'),
  border: `${tokens.border.hair} solid ${slot('ink', 'hairline')}`,
  borderRadius: tokens.radius.sm,
  padding: `${tokens.space[4]} ${tokens.space[8]}`,
  fontFamily: 'var(--font-numeric)',
  fontSize: tokens.type.small,
} as const;

/**
 * Finding a move, and reading what it says before doing it.
 *
 * The reading is the point. The application has always held the full text of
 * every move and never shown a word of it, so a person choosing from a list
 * of fifty-four names had no way to know what any of them meant.
 *
 * Shown here, at choosing time, rather than on the card afterwards. By the
 * time a card exists the question has been answered by doing the thing, and a
 * card carrying a paragraph would bury what actually happened.
 *
 * See `design/the-journal-you-play-in.md`.
 */

/** Every word typed has to match somewhere in the name. */
function matching(checks: readonly CheckView[], query: string): readonly CheckView[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/u)
    .filter((term) => term !== '');
  if (terms.length === 0) return checks;

  return checks.filter((check) => {
    const name = check.name.toLowerCase();
    return terms.every((term) => name.includes(term));
  });
}

/** How many dice a move asks for, which is how many a person may type in. */
function diceWanted(check: CheckView): number {
  return (check.dice ?? []).reduce((total, spec) => total + spec.count, 0);
}

export interface MovePaletteProps {
  readonly open: boolean;
  readonly checks: readonly CheckView[];
  readonly busy: boolean;
  readonly onRead: (docRef: string) => Promise<ReferenceDocView | undefined>;
  readonly onRun: (request: RunCheckRequest) => void;
  readonly onClose: () => void;
}

export function MovePalette({
  open,
  checks,
  busy,
  onRead,
  onRun,
  onClose,
}: MovePaletteProps): React.JSX.Element | null {
  const [query, setQuery] = useState('');
  const [at, setAt] = useState(0);
  const [reading, setReading] = useState<ReferenceDocView | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [thrown, setThrown] = useState('');

  const found = matching(checks, query);
  const chosen = found[Math.min(at, found.length - 1)];

  useEffect(() => {
    if (!open) {
      setQuery('');
      setAt(0);
      setReading(null);
      setInputs({});
      setThrown('');
    }
  }, [open]);

  // Moving to another move forgets what was typed for the last one. Two moves
  // both taking a stat would otherwise share a number nobody meant to reuse.
  useEffect(() => {
    setInputs({});
    setThrown('');
  }, [chosen?.id]);

  // What the highlighted move says. Fetched as the highlight moves, so a
  // person reading down the list reads each one as they pass it.
  useEffect(() => {
    if (!open) return;
    const docRef = chosen?.docRef;
    if (docRef === undefined) {
      setReading(null);
      return;
    }

    let current = true;
    void onRead(docRef).then((document) => {
      if (current) setReading(document ?? null);
    });
    return () => {
      current = false;
    };
  }, [open, chosen?.docRef, onRead]);

  const wanted = chosen === undefined ? 0 : diceWanted(chosen);
  const typedIn = thrown
    .split(/[\s,]+/u)
    .filter((each) => each !== '')
    .map(Number);

  /**
   * Do the move.
   *
   * An untouched box holds whatever the application suggested, and somebody
   * who typed something else has already declined it by typing. Dice are
   * taken when as many were typed in as the move asks for, and rolled
   * otherwise; a move with none is done without any.
   */
  const run = (): void => {
    if (chosen === undefined || busy) return;

    const numbers: Record<string, number> = {};
    for (const input of chosen.inputs) {
      const fallback = input.suggested?.value ?? 0;
      numbers[input.id] = Number(inputs[input.id] ?? fallback) || 0;
    }

    onRun({
      systemId: chosen.systemId,
      checkId: chosen.id,
      inputs: numbers,
      ...(typedIn.length === wanted && wanted > 0 ? { thrown: typedIn } : {}),
    });
  };

  return (
    <Palette
      data-testid="move-palette"
      open={open}
      title="Make a move"
      placeholder="Part of a move's name: danger, vow, session"
      query={query}
      onQuery={(typed) => {
        setQuery(typed);
        setAt(0);
      }}
      count={found.length}
      at={at}
      onAt={setAt}
      onChoose={run}
      onClose={onClose}
    >
      <PaletteList data-testid="move-results">
        {found.map((check, index) => (
          <li key={check.id}>
            <PaletteRow
              data-testid="move-result"
              chosen={index === at}
              onClick={() => setAt(index)}
            >
              {check.name}
            </PaletteRow>
          </li>
        ))}

        {found.length === 0 && (
          <li style={{ ...labelStyle('line'), padding: tokens.space[8] }}>Nothing matches that</li>
        )}
      </PaletteList>

      {/*
        The move's own words. Scrolls itself, because some moves are three
        lines and some are most of a page, and a palette that grows to fit the
        longest one pushes everything under it out of reach.
      */}
      {reading !== null && (
        <div
          data-testid="move-text"
          style={{
            maxHeight: tokens.layout.paletteText,
            overflowY: 'auto',
            padding: tokens.space[12],
            borderRadius: tokens.radius.md,
            background: slot('ground', 'sunken'),
            color: slot('ink', 'secondary'),
            fontFamily: 'var(--font-prose)',
            fontSize: tokens.type.compact,
            lineHeight: tokens.lineHeight.prose,
            whiteSpace: 'pre-wrap',
          }}
        >
          {reading.text}
        </div>
      )}

      {reading === null && chosen !== undefined && (
        <Label size="line" as="p" data-testid="move-text-missing">
          This move&apos;s text is not on this machine.
        </Label>
      )}

      {chosen !== undefined && (
        <div style={{ display: 'grid', gap: tokens.space[8] }}>
          {chosen.inputs.map((input) => (
            <span
              key={input.id}
              style={{ display: 'flex', gap: tokens.space[8], alignItems: 'center' }}
            >
              <Label as="label" htmlFor={`input-${input.id}`}>
                {input.label}
              </Label>
              <input
                id={`input-${input.id}`}
                data-testid={`input-${input.id}`}
                inputMode="numeric"
                placeholder="0"
                value={
                  inputs[input.id] ??
                  (input.suggested === undefined ? '' : String(input.suggested.value))
                }
                onChange={(event) =>
                  setInputs((held) => ({ ...held, [input.id]: event.target.value }))
                }
                style={{ ...FIELD, width: '6ch' }}
              />
              {input.suggested !== undefined && (
                <Label size="line" data-testid={`suggested-${input.id}`}>
                  suggested, because {input.suggested.why}
                </Label>
              )}
            </span>
          ))}

          {/*
            A move with nothing to roll gets no box to type dice into, and a
            verb that says what the button does. "Roll it" on a move with no
            dice is the application lying about its own control.
          */}
          {wanted > 0 && (
            <span style={{ display: 'flex', gap: tokens.space[8], alignItems: 'center' }}>
              <Label as="label" htmlFor="move-thrown">
                Dice you threw
              </Label>
              <input
                id="move-thrown"
                data-testid="thrown"
                value={thrown}
                placeholder={`${String(wanted)} numbers, or leave it empty to roll`}
                onChange={(event) => setThrown(event.target.value)}
                style={{ ...FIELD, width: '24ch' }}
              />
            </span>
          )}

          <Button
            data-testid="roll-it"
            disabled={busy}
            onClick={run}
            style={{ justifySelf: 'start' }}
          >
            {wanted === 0 ? 'Do it' : typedIn.length === wanted ? 'Take those dice' : 'Roll it'}
          </Button>
        </div>
      )}
    </Palette>
  );
}
