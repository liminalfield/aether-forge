import { slot } from './theme.js';
import { TABULAR_NUMERALS, tokens } from './tokens.js';

/**
 * A row of segments, some of them filled.
 *
 * Two shapes, and the difference carries meaning rather than decoration. A
 * bar is something being spent: health, supply, a resource going down. Boxes
 * are something being earned: progress towards a thing a person is trying to
 * do. The design record puts it as telling the player's own progress from the
 * world's without reading a label, which only works if the shapes stay
 * attached to their meanings.
 *
 * Which shape a track takes is the owning module's to say, because only it
 * knows whether its track is spent or earned. It reaches here as a prop.
 *
 * The number is always shown beside the shape. A meter a person has to count
 * is a worse meter, and somebody reading the screen aloud gets the number
 * rather than a description of some boxes.
 */

export type MeterShape = 'bar' | 'boxes';

export interface MeterProps {
  readonly segments: number;
  /** May stand past full or below empty; drawn honestly either way. */
  readonly filled: number;
  readonly shape?: MeterShape;
  /** What it is called, for anything reading the screen aloud. */
  readonly label: string;
  readonly 'data-testid'?: string;
}

/** How many segments to draw, and how many of them are filled. */
function drawn(segments: number, filled: number): { total: number; marked: number } {
  const total = Math.max(0, Math.trunc(segments));
  return { total, marked: Math.min(total, Math.max(0, Math.trunc(filled))) };
}

export function Meter({
  segments,
  filled,
  shape = 'bar',
  label,
  'data-testid': testId,
}: MeterProps): React.JSX.Element {
  const { total, marked } = drawn(segments, filled);

  return (
    <span
      data-testid={testId}
      role="img"
      aria-label={`${label}, ${String(filled)} of ${String(segments)}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: tokens.space[8] }}
    >
      <span
        aria-hidden="true"
        style={{ display: 'inline-flex', gap: shape === 'bar' ? tokens.space[2] : tokens.space[4] }}
      >
        {Array.from({ length: total }, (_unused, at) => (
          <span
            key={at}
            style={{
              width: shape === 'bar' ? tokens.space[8] : tokens.space[12],
              height: tokens.space[12],
              borderRadius: shape === 'bar' ? tokens.radius.sm : 0,
              border: `${tokens.border.hair} solid ${slot('ink', 'hairline')}`,
              background: at < marked ? slot('accent', 'accent') : 'transparent',
            }}
          />
        ))}
      </span>

      <span
        style={{
          fontFamily: 'var(--font-numeric)',
          fontSize: tokens.type.small,
          color: slot('ink', 'muted'),
          ...TABULAR_NUMERALS,
        }}
      >
        {filled}/{segments}
      </span>
    </span>
  );
}
