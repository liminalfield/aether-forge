import { useEffect, useRef, type ReactNode } from 'react';

import { KeyHint } from './KeyHint.js';
import { Label, labelStyle } from './Label.js';
import { slot } from './theme.js';
import { tokens } from './tokens.js';

/**
 * A box that opens over the page, with a search in it.
 *
 * You are in the middle of a sentence when you want to ask something, and a
 * surface you have to go to is a surface you stop writing to use. So it
 * arrives over the writing and leaves again.
 *
 * The frame is shared so that two palettes cannot drift into being two things
 * to learn. What goes under the search is each palette's own: what you do
 * after choosing differs, and that is the part worth keeping separate.
 *
 * See `design/the-journal-you-play-in.md`.
 */

export interface PaletteProps {
  readonly open: boolean;
  /** What this palette is for, above the search. */
  readonly title: string;
  readonly placeholder: string;
  readonly query: string;
  readonly onQuery: (query: string) => void;
  /** How many rows there are, so the keys know where the ends are. */
  readonly count: number;
  readonly at: number;
  readonly onAt: (at: number) => void;
  /** Enter, on whatever is highlighted. */
  readonly onChoose: () => void;
  readonly onClose: () => void;
  readonly 'data-testid'?: string;
  readonly children: ReactNode;
}

/**
 * Where a key moves the highlight, or nothing when it is not a key that does.
 *
 * A decision rather than a handler, so it can be tested as the table of cases
 * it is. Both ends stop rather than wrapping: a list that jumps from the last
 * row to the first loses somebody who was holding the key down.
 */
export function paletteKeyIntent(
  key: string,
  at: number,
  count: number,
): { readonly move: number } | 'choose' | 'close' | undefined {
  if (key === 'Escape') return 'close';
  if (key === 'Enter') return 'choose';
  if (key === 'ArrowDown') return { move: Math.min(at + 1, Math.max(count - 1, 0)) };
  if (key === 'ArrowUp') return { move: Math.max(at - 1, 0) };
  return undefined;
}

export function Palette({
  open,
  title,
  placeholder,
  query,
  onQuery,
  count,
  at,
  onAt,
  onChoose,
  onClose,
  'data-testid': testId,
  children,
}: PaletteProps): ReactNode {
  const searching = useRef<HTMLInputElement>(null);

  // Opening puts the cursor where a person is about to type.
  useEffect(() => {
    if (open) searching.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      data-testid={testId}
      role="dialog"
      aria-label={title}
      onKeyDown={(event) => {
        const intent = paletteKeyIntent(event.key, at, count);
        if (intent === undefined) return;

        event.preventDefault();
        if (intent === 'close') onClose();
        else if (intent === 'choose') onChoose();
        else onAt(intent.move);
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
          // Everything inside is capped and it still adds up. The box scrolls
          // so the controls at its foot can always be reached.
          maxHeight: tokens.layout.paletteBox,
          overflowY: 'auto',
          display: 'grid',
          gap: tokens.space[12],
          padding: tokens.space[16],
          background: slot('ground', 'raised'),
          border: `${tokens.border.hair} solid ${slot('ink', 'hairline')}`,
          borderRadius: tokens.radius.lg,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Label as="label" htmlFor="palette-search">
            {title}
          </Label>
          <span style={labelStyle('line')}>
            <KeyHint>esc to close</KeyHint>
          </span>
        </div>

        <input
          id="palette-search"
          ref={searching}
          data-testid="palette-search"
          value={query}
          placeholder={placeholder}
          onChange={(event) => onQuery(event.target.value)}
          style={{
            background: slot('ground', 'raised'),
            color: slot('ink', 'primary'),
            border: `${tokens.border.hair} solid ${slot('ink', 'hairline')}`,
            borderRadius: tokens.radius.sm,
            padding: `${tokens.space[8]} ${tokens.space[12]}`,
            fontFamily: 'var(--font-ui)',
            fontSize: tokens.type.compact,
          }}
        />

        {children}
      </section>
    </div>
  );
}

/**
 * One row in a palette's list.
 *
 * Its own component so the highlight, the hit area and the two-part layout
 * are the same in both, which is what "the same shape" has to mean to be
 * worth anything.
 */
export interface PaletteRowProps {
  readonly chosen: boolean;
  readonly onClick: () => void;
  /** The thing itself. */
  readonly children: ReactNode;
  /** Where it sits, or anything else said quietly at the right. May be absent. */
  readonly aside?: string;
  readonly 'data-testid'?: string;
}

export function PaletteRow({
  chosen,
  onClick,
  children,
  aside,
  'data-testid': testId,
}: PaletteRowProps): ReactNode {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-current={chosen}
      onClick={onClick}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: tokens.space[12],
        width: '100%',
        textAlign: 'left',
        padding: `${tokens.space[4]} ${tokens.space[8]}`,
        border: 'none',
        borderRadius: tokens.radius.sm,
        background: chosen ? slot('ground', 'overlay') : 'transparent',
        color: slot('ink', 'primary'),
        fontFamily: 'var(--font-ui)',
        fontSize: tokens.type.compact,
        cursor: 'pointer',
      }}
    >
      <span>{children}</span>
      {aside !== undefined && <span style={labelStyle('line')}>{aside}</span>}
    </button>
  );
}

/**
 * The list a palette's rows sit in.
 *
 * It scrolls itself rather than growing. Thirty rows is a lot, and a list
 * that grows pushes whatever sits under it off the bottom of the window,
 * where nothing can reach it.
 */
export function PaletteList({
  children,
  'data-testid': testId,
}: {
  readonly children: ReactNode;
  readonly 'data-testid'?: string;
}): ReactNode {
  return (
    <ul
      data-testid={testId}
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'grid',
        maxHeight: tokens.layout.paletteList,
        overflowY: 'auto',
      }}
    >
      {children}
    </ul>
  );
}
