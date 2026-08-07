import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Chip } from './Chip.js';
import { ChipRow } from './ChipRow.js';

function render(element: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(element);
}

describe('a chip', () => {
  it('shows what it was given', () => {
    expect(render(<Chip>Pay the price</Chip>)).toContain('Pay the price');
  });

  it('is a button that does not submit unless asked', () => {
    expect(render(<Chip>Pay the price</Chip>)).toContain('type="button"');
  });

  it('names no colour of its own', () => {
    // Everything it draws with is a property the application has set, so a
    // theme reaches it without it knowing a theme exists.
    const markup =
      render(<Chip weight="leading">Take it</Chip>) +
      render(<Chip>Pay the price</Chip>) +
      render(<Chip weight="declining">Just write</Chip>);

    expect(markup).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(markup).not.toMatch(/rgba?\(/i);
  });

  it('moves for exactly as long as the application says', () => {
    expect(render(<Chip>Take it</Chip>)).toContain('var(--duration-enter)');
  });

  it('passes everything else through', () => {
    const markup = render(
      <Chip disabled aria-keyshortcuts="Escape">
        Just write
      </Chip>,
    );

    expect(markup).toContain('disabled');
    expect(markup).toContain('aria-keyshortcuts="Escape"');
  });
});

describe('the key that takes it', () => {
  it('is shown beside the answer', () => {
    expect(render(<Chip hint="esc">Just write</Chip>)).toContain('esc');
  });

  it('is hidden from anything reading the page aloud', () => {
    // A chip announced as "pay the price P" is worse than one announced as
    // "pay the price".
    expect(render(<Chip hint="P">Pay the price</Chip>)).toContain('aria-hidden="true"');
  });

  it('is left out entirely when there is none', () => {
    expect(render(<Chip>Pay the price</Chip>)).not.toContain('aria-hidden');
  });
});

describe('the three weights', () => {
  it('draws the leading answer in the accent', () => {
    expect(render(<Chip weight="leading">Take it</Chip>)).toContain('var(--accent-accent)');
  });

  it('draws an ordinary answer without it', () => {
    expect(render(<Chip>Pay the price</Chip>)).not.toContain('var(--accent-accent)');
  });

  it('makes the declining chip visibly different from every other one', () => {
    // The product's whole position, in one control. An interface where
    // declining is harder to find than accepting has an opinion, whatever the
    // log records.
    const declining = render(<Chip weight="declining">Just write</Chip>);

    expect(declining).toContain('dashed');
    expect(render(<Chip weight="leading">Take it</Chip>)).not.toContain('dashed');
    expect(render(<Chip>Pay the price</Chip>)).not.toContain('dashed');
  });
});

describe('a caller nudging one thing', () => {
  it('keeps everything it did not ask to change', () => {
    const markup = render(<Chip style={{ marginLeft: 'auto' }}>Take it</Chip>);

    expect(markup).toContain('margin-left:auto');
    expect(markup).toContain('border-radius:999px');
  });
});

describe('a row of them', () => {
  const aRow = (
    <ChipRow label="What to do about it">
      <Chip weight="leading" hint="⏎">
        Take it
      </Chip>
      <Chip hint="P">Pay the price</Chip>
      <Chip weight="declining" hint="esc">
        Just write
      </Chip>
    </ChipRow>
  );

  it('groups the answers and says what they are for', () => {
    const markup = render(aRow);

    expect(markup).toContain('role="group"');
    expect(markup).toContain('aria-label="What to do about it"');
  });

  it('keeps them in the order it was given', () => {
    // Ordered by consequence, and only the thing that knows what they mean can
    // say what that order is.
    const markup = render(aRow);

    expect(markup.indexOf('Take it')).toBeLessThan(markup.indexOf('Pay the price'));
    expect(markup.indexOf('Pay the price')).toBeLessThan(markup.indexOf('Just write'));
  });

  it('wraps rather than running off the edge', () => {
    // A row of choices that scrolls hides an answer somebody has.
    expect(render(aRow)).toContain('flex-wrap:wrap');
  });

  it('holds exactly one way out, however many answers there are', () => {
    const markup = render(aRow);
    expect(markup.split('dashed')).toHaveLength(2);
  });

  it('is fine with a single answer, and with none', () => {
    expect(render(<ChipRow label="What to do about it">{null}</ChipRow>)).toContain('role="group"');
    expect(
      render(
        <ChipRow label="What to do about it">
          <Chip weight="declining" hint="esc">
            Just write
          </Chip>
        </ChipRow>,
      ),
    ).toContain('Just write');
  });
});
