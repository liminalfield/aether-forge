import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Meter } from './Meter.js';

/** How many segment boxes the markup drew. */
function segmentsIn(markup: string): number {
  return (markup.match(/border-radius|border:/g) ?? []).length;
}

describe('a row of segments', () => {
  it('draws one segment per segment, and fills the ones that are filled', () => {
    const markup = renderToStaticMarkup(<Meter label="Supply" segments={5} filled={3} />);

    // Three filled segments carry the accent; two do not.
    expect((markup.match(/var\(--accent-accent\)/g) ?? []).length).toBe(3);
    expect(segmentsIn(markup)).toBeGreaterThanOrEqual(5);
  });

  it('says the number as well as drawing it', () => {
    // A meter a person has to count is a worse meter.
    expect(renderToStaticMarkup(<Meter label="Supply" segments={5} filled={3} />)).toContain('3');
  });

  it('reads as a number to anything reading the screen aloud, not as some boxes', () => {
    const markup = renderToStaticMarkup(<Meter label="Supply" segments={5} filled={3} />);

    expect(markup).toContain('aria-label="Supply, 3 of 5"');
    expect(markup).toContain('aria-hidden="true"');
  });

  it('draws a thing being spent differently from a thing being earned', () => {
    // The difference is meaning, not decoration: it is how one is told from
    // the other without reading a label.
    const spent = renderToStaticMarkup(
      <Meter label="Supply" segments={5} filled={3} shape="bar" />,
    );
    const earned = renderToStaticMarkup(
      <Meter label="Progress" segments={5} filled={3} shape="boxes" />,
    );

    expect(spent).not.toBe(earned);
  });

  it('draws a fill past full as full, and still says the real number', () => {
    // The projection reports what the log says, and so does this. Twelve of
    // ten is a real state; drawing thirteen segments in a ten-segment row is
    // not, so the shape stops and the number tells the truth.
    const markup = renderToStaticMarkup(<Meter label="Pressure" segments={5} filled={9} />);

    expect((markup.match(/var\(--accent-accent\)/g) ?? []).length).toBe(5);
    expect(markup).toContain('9');
    expect(markup).toContain('aria-label="Pressure, 9 of 5"');
  });

  it('draws a fill below empty as empty, and still says the real number', () => {
    const markup = renderToStaticMarkup(<Meter label="Supply" segments={5} filled={-2} />);

    expect(markup).not.toContain('var(--accent-accent)');
    expect(markup).toContain('aria-label="Supply, -2 of 5"');
  });

  it('names no colour and no size of its own', () => {
    const markup = renderToStaticMarkup(<Meter label="Supply" segments={5} filled={3} />);

    expect(markup).not.toMatch(/#[0-9a-f]{3,8}/i);
  });
});
