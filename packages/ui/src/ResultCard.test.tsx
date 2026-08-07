import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Chip } from './Chip.js';
import { ChipRow } from './ChipRow.js';
import { ResultCard, type ResultCardProps } from './ResultCard.js';

function render(element: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(element);
}

/**
 * A system that rolls three dice and works out a figure from them.
 *
 * Obviously-dummy: nothing here is a published check. What matters is the
 * shape, which is one die of one kind and two of another.
 */
const THREE_DICE: ResultCardProps = {
  name: 'Face it',
  detail: 'edge +2',
  outcome: { label: 'Weak hit', glyph: '◐', tone: 'weak' },
  dice: [
    { value: 4, label: 'first', from: 'thrown' },
    { value: 2, label: 'second', from: 'rolled', emphasis: true },
    { value: 9, label: 'second', from: 'rolled', emphasis: true },
  ],
  total: { label: 'total', value: 6 },
  reference: 'example.dummy/face-it',
};

/** A system whose whole mechanic is one coin, and which works out no figure. */
const ONE_DIE: ResultCardProps = {
  name: 'Call it',
  outcome: { label: 'Heads', glyph: '●', tone: 'strong' },
  dice: [{ value: 1, from: 'rolled' }],
};

describe('a card for a system with three dice', () => {
  it('shows what ran, what it ran with, and how it turned out', () => {
    const markup = render(<ResultCard {...THREE_DICE} />);

    expect(markup).toContain('Face it');
    expect(markup).toContain('edge +2');
    expect(markup).toContain('Weak hit');
  });

  it('shows every die', () => {
    const markup = render(<ResultCard {...THREE_DICE} />);

    expect(markup).toContain('>4<');
    expect(markup).toContain('>2<');
    expect(markup).toContain('>9<');
  });

  it('draws the dice sharing a label together, in the order they arrived', () => {
    // The whole mechanism. A system's arrangement comes out of how it labelled
    // its dice, not out of the component knowing what it is drawing.
    const markup = render(<ResultCard {...THREE_DICE} />);

    expect(markup.indexOf('first')).toBeLessThan(markup.indexOf('second'));
    expect(markup.split('second')).toHaveLength(2);
  });

  it('shows the figure the module worked out', () => {
    expect(render(<ResultCard {...THREE_DICE} />)).toContain('>6<');
  });
});

describe('a card for a system with one die', () => {
  it('is the same component, and draws one', () => {
    // The canary. If a coin flip cannot produce a card, the component is built
    // around one particular system after all, and it is the component that is
    // wrong rather than the system.
    const markup = render(<ResultCard {...ONE_DIE} />);

    expect(markup).toContain('Call it');
    expect(markup).toContain('Heads');
    expect(markup).toContain('>1<');
  });

  it('shows no figure when the module worked none out', () => {
    // Not every system adds its dice up, and one that does not should not get
    // an empty space where a figure would be.
    expect(render(<ResultCard {...ONE_DIE} />)).not.toContain('>=<');
    expect(render(<ResultCard {...THREE_DICE} />)).toContain('>=<');
  });

  it('shows no detail when there is none', () => {
    expect(render(<ResultCard {...ONE_DIE} />)).not.toContain('undefined');
  });
});

describe('the strip at the foot', () => {
  it('says how many dice were thrown and how many were rolled', () => {
    // The gate. Somebody reading their own log a year later should not have to
    // go looking for whether they threw those dice themselves.
    expect(render(<ResultCard {...THREE_DICE} />)).toContain('1 thrown, 2 rolled');
  });

  it('counts a way the numbers arrived that nobody has thought of yet', () => {
    // Words rather than a fixed set, so a die from somewhere new needs no
    // change here.
    const markup = render(
      <ResultCard
        {...ONE_DIE}
        dice={[
          { value: 3, from: 'a shared table' },
          { value: 5, from: 'a shared table' },
        ]}
      />,
    );

    expect(markup).toContain('2 a shared table');
  });

  it('describes the same roll the same way every time', () => {
    expect(render(<ResultCard {...THREE_DICE} />)).toBe(render(<ResultCard {...THREE_DICE} />));
  });

  it('names what it can be traced back to', () => {
    expect(render(<ResultCard {...THREE_DICE} />)).toContain('example.dummy/face-it');
  });
});

describe('the outcome', () => {
  it('carries a glyph as well as a colour', () => {
    // A person with a badly chosen palette, or no colour vision, still reads
    // the card.
    expect(render(<ResultCard {...THREE_DICE} />)).toContain('◐');
  });

  it('hides the glyph from anything reading the page aloud', () => {
    // The word is right beside it. Hearing "circle with left half black weak
    // hit" is worse than hearing "weak hit".
    expect(render(<ResultCard {...THREE_DICE} />)).toContain('aria-hidden="true"');
  });

  it('colours the whole card, not only the word', () => {
    expect(render(<ResultCard {...THREE_DICE} />)).toContain('var(--outcome-weak)');
    expect(render(<ResultCard {...ONE_DIE} />)).toContain('var(--outcome-strong)');
  });

  it('marks only the dice the module said it turned on', () => {
    const markup = render(<ResultCard {...THREE_DICE} />);
    expect(markup.split('border:1px solid var(--outcome-weak)')).toHaveLength(3);
  });
});

describe('the card as a whole', () => {
  it('names no colour of its own', () => {
    const markup = render(<ResultCard {...THREE_DICE} />) + render(<ResultCard {...ONE_DIE} />);

    expect(markup).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(markup).not.toMatch(/rgba?\(/i);
  });

  it('holds the answers it was given', () => {
    const markup = render(
      <ResultCard {...THREE_DICE}>
        <ChipRow label="What to do about it">
          <Chip weight="leading" hint="⏎">
            Take it
          </Chip>
          <Chip weight="declining" hint="esc">
            Just write
          </Chip>
        </ChipRow>
      </ResultCard>,
    );

    expect(markup).toContain('Take it');
    expect(markup).toContain('Just write');
    expect(markup).toContain('role="group"');
  });

  it('is a card with nothing to answer when nothing was proposed', () => {
    // An outcome a module has no opinion about is the ordinary case for some
    // systems, and it still deserves a card.
    expect(render(<ResultCard {...ONE_DIE} />)).toContain('Call it');
  });
});
