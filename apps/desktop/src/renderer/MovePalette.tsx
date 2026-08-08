import { useEffect, useState } from 'react';

import {
  Label,
  labelStyle,
  Palette,
  PaletteList,
  PaletteRow,
  slot,
  tokens,
} from '@aether-forge/ui';

import type { CheckView, ReferenceDocView } from '../shared/ipc';

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

export interface MovePaletteProps {
  readonly open: boolean;
  readonly checks: readonly CheckView[];
  readonly onRead: (docRef: string) => Promise<ReferenceDocView | undefined>;
  readonly onClose: () => void;
}

export function MovePalette({
  open,
  checks,
  onRead,
  onClose,
}: MovePaletteProps): React.JSX.Element | null {
  const [query, setQuery] = useState('');
  const [at, setAt] = useState(0);
  const [reading, setReading] = useState<ReferenceDocView | null>(null);

  const found = matching(checks, query);
  const chosen = found[Math.min(at, found.length - 1)];

  useEffect(() => {
    if (!open) {
      setQuery('');
      setAt(0);
      setReading(null);
    }
  }, [open]);

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
      onChoose={() => {
        /* Choosing shows the move. Doing it arrives in the next step. */
      }}
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
            maxHeight: tokens.layout.paletteList,
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
    </Palette>
  );
}
