import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { KeyHint } from './KeyHint.js';
import { Label, labelStyle } from './Label.js';

describe('the small capitalised label', () => {
  it('names no colour and no size of its own', () => {
    // The point of having it: six files were writing this by hand, and had
    // begun to disagree about the size. Everything it uses comes from the
    // theme or the scale.
    const style = labelStyle();

    expect(style.color).toMatch(/^var\(--/);
    expect(style.fontFamily).toMatch(/^var\(--/);
  });

  it('is smaller and wider above a field than along a line', () => {
    expect(labelStyle('field').fontSize).not.toBe(labelStyle('line').fontSize);
    expect(labelStyle('field').letterSpacing).not.toBe(labelStyle('line').letterSpacing);
  });

  it('renders as whatever element the job needs', () => {
    expect(renderToStaticMarkup(<Label as="label">Stat</Label>)).toContain('<label');
    expect(renderToStaticMarkup(<Label as="h2">Vows</Label>)).toContain('<h2');
  });

  it('lets a caller position it without restating what a label looks like', () => {
    const markup = renderToStaticMarkup(<Label style={{ gridColumn: '1 / -1' }}>Stat</Label>);

    expect(markup).toContain('grid-column');
    expect(markup).toContain('text-transform:uppercase');
  });
});

describe('the key hint', () => {
  it('is shown, and hidden from anything reading the page aloud', () => {
    // The control it sits in already announces its shortcut. Hearing it twice
    // is worse than hearing it once, and forgetting the hiding is invisible.
    const markup = renderToStaticMarkup(<KeyHint>esc</KeyHint>);

    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('esc');
  });
});
