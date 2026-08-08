import type { HTMLAttributes, ReactNode } from 'react';

import { labelStyle } from './Label.js';
import { slot, type SlotName } from './theme.js';
import { TABULAR_NUMERALS, tokens } from './tokens.js';

/**
 * What a roll turned out to be, as the card shows it.
 *
 * `label` and `glyph` are the module's, because only it knows what its own
 * results are called. `tone` picks the colour, and the glyph travels with it so
 * that colour is never carrying the meaning on its own. A person with a badly
 * chosen palette, or no colour vision, still reads the card.
 */
export interface CardOutcome {
  readonly label: string;
  readonly glyph: string;
  readonly tone: SlotName<'outcome'>;
}

/** One die, as the card shows it. */
export interface CardDie {
  readonly value: number;
  /**
   * What the module calls it. Dice sharing a label are drawn together, which is
   * the whole mechanism by which a system's arrangement comes out of this
   * component without the component knowing what it is drawing.
   */
  readonly label?: string;
  /**
   * Where the number came from, in words a person reads: `rolled`, `thrown`, or
   * the name of whatever supplied it.
   *
   * Words rather than a fixed set, so a die that arrived from somewhere nobody
   * has thought of yet needs no change here. The card counts them and never
   * interprets them.
   */
  readonly from: string;
  /**
   * Drawn in the outcome colour, for the dice the result actually turned on.
   *
   * The module says which. A component deciding it would have to know what the
   * dice mean.
   */
  readonly emphasis?: boolean;
}

/** A figure the module worked out from the dice, if it works one out at all. */
export interface CardTotal {
  readonly label: string;
  readonly value: number;
}

export interface ResultCardProps extends Omit<HTMLAttributes<HTMLElement>, 'className' | 'title'> {
  /** What ran. The module's words. */
  readonly name: string;
  /** What it ran with. The module's words again, and often absent. */
  readonly detail?: string;
  readonly outcome: CardOutcome;
  readonly dice: readonly CardDie[];
  readonly total?: CardTotal;
  /** Named in the strip at the foot, so a result can be traced back to its text. */
  readonly reference?: string;
  /** The answers. A chip row belongs here. */
  readonly children?: ReactNode;
}

/** The label a group of dice was given, in the order the labels first appear. */
function groupsOf(dice: readonly CardDie[]): readonly (readonly CardDie[])[] {
  const order: (string | undefined)[] = [];
  const grouped = new Map<string | undefined, CardDie[]>();

  for (const die of dice) {
    const existing = grouped.get(die.label);
    if (existing === undefined) {
      order.push(die.label);
      grouped.set(die.label, [die]);
      continue;
    }
    existing.push(die);
  }

  return order.map((label) => grouped.get(label) ?? []);
}

/**
 * Where the dice came from, counted.
 *
 * Reads as "one thrown, two rolled" rather than listing every die, because the
 * strip is there to be glanced at. In the order each way first appears, so the
 * same roll always describes itself the same way.
 */
function provenanceOf(dice: readonly CardDie[]): readonly string[] {
  const order: string[] = [];
  const counted = new Map<string, number>();

  for (const die of dice) {
    const seen = counted.get(die.from);
    if (seen === undefined) order.push(die.from);
    counted.set(die.from, (seen ?? 0) + 1);
  }

  return order.map((from) => `${String(counted.get(from))} ${from}`);
}

const QUIET_LABEL = {
  ...labelStyle('line'),
} as const;

/**
 * What a check turned out to be, and what to do about it.
 *
 * The centrepiece of the design, and the first thing in the application that
 * shows a person a decision and waits.
 *
 * It knows nothing about any game. It is handed a list of labelled dice, a
 * figure if the module worked one out, and an outcome with a word, a glyph and
 * a colour. A system with one die, or five, or none, produces a card from the
 * same component, and the arrangement of any particular system falls out of how
 * that system labelled its dice.
 *
 * Three zones and a strip: what ran and how it turned out, the dice, the
 * answers, and underneath, where the numbers came from. The strip is never
 * behind an expander. Somebody reading their own log a year later should not
 * have to go looking for whether they threw those dice themselves.
 */
export function ResultCard({
  name,
  detail,
  outcome,
  dice,
  total,
  reference,
  style,
  children,
  ...rest
}: ResultCardProps): ReactNode {
  const groups = groupsOf(dice);
  const provenance = provenanceOf(dice);

  return (
    <article
      style={{
        background: slot('ground', 'raised'),
        border: `1px solid ${slot('ink', 'hairline')}`,
        // The one place the outcome colour carries across the whole card, so it
        // is legible from further away than the word is.
        borderTop: `2px solid ${slot('outcome', outcome.tone)}`,
        borderRadius: tokens.radius.md,
        overflow: 'hidden',
        ...style,
      }}
      {...rest}
    >
      <div
        style={{
          display: 'grid',
          gap: tokens.box.cardGap,
          padding: `${tokens.box.cardPadY} ${tokens.box.cardPadX}`,
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: tokens.space[16],
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{ fontFamily: 'var(--font-ui)', fontSize: tokens.type.base, fontWeight: 600 }}
          >
            {name}
          </span>
          {detail !== undefined && <span style={QUIET_LABEL}>{detail}</span>}
          <span
            style={{
              ...QUIET_LABEL,
              marginLeft: 'auto',
              color: slot('outcome', outcome.tone),
              fontWeight: 500,
            }}
          >
            <span aria-hidden="true">{outcome.glyph}</span> {outcome.label}
          </span>
        </header>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: tokens.space[8],
            flexWrap: 'wrap',
            fontFamily: 'var(--font-numeric)',
            fontSize: tokens.type.reading,
            ...TABULAR_NUMERALS,
          }}
        >
          {groups.map((group, index) => (
            <div
              key={group[0]?.label ?? index}
              style={{ display: 'flex', alignItems: 'center', gap: tokens.space[8] }}
            >
              {group.map((die, position) => (
                <span
                  key={position}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: tokens.box.die,
                    height: tokens.box.die,
                    background: slot('ground', 'overlay'),
                    border: `1px solid ${
                      die.emphasis === true ? slot('outcome', outcome.tone) : 'transparent'
                    }`,
                    borderRadius: tokens.radius.sm,
                  }}
                >
                  {die.value}
                </span>
              ))}
              {group[0]?.label !== undefined && <span style={QUIET_LABEL}>{group[0].label}</span>}
            </div>
          ))}

          {total !== undefined && (
            <span style={{ display: 'flex', alignItems: 'center', gap: tokens.space[8] }}>
              <span style={{ color: slot('ink', 'muted') }}>=</span>
              <span style={{ fontWeight: 600 }}>{total.value}</span>
              <span style={QUIET_LABEL}>{total.label}</span>
            </span>
          )}
        </div>

        {children}
      </div>

      <div
        style={{
          borderTop: `1px solid ${slot('ink', 'hairline')}`,
          background: slot('ground', 'void'),
          padding: '10px 18px',
          ...QUIET_LABEL,
          textTransform: 'none',
          letterSpacing: 'normal',
          display: 'flex',
          gap: tokens.space[16],
          flexWrap: 'wrap',
        }}
      >
        <span>{provenance.join(', ')}</span>
        {reference !== undefined && <span style={{ marginLeft: 'auto' }}>{reference}</span>}
      </div>
    </article>
  );
}
