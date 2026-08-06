import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Button } from './Button.js';

/**
 * Rendered to markup rather than into a page.
 *
 * A component library that needed a fake browser to test a button would have
 * bought a dependency for no gain. What is worth checking here is what the
 * component decides, and that is all in the markup it produces.
 */
function render(element: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(element);
}

describe('a button', () => {
  it('shows what it was given', () => {
    expect(render(<Button>Record it</Button>)).toContain('Record it');
  });

  it('is a button that does not submit unless asked', () => {
    // A button inside a form submits it by default, which is rarely what the
    // caller meant and always surprising when it happens.
    expect(render(<Button>Cancel</Button>)).toContain('type="button"');
    expect(render(<Button type="submit">Save</Button>)).toContain('type="submit"');
  });

  it('names no colour of its own', () => {
    // Everything it draws with is a property the application has set, so a
    // theme reaches it without it knowing a theme exists.
    const markup = render(<Button>Record it</Button>) + render(<Button weight="quiet">No</Button>);

    expect(markup).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(markup).not.toMatch(/rgba?\(/i);
  });

  it('draws the two weights differently', () => {
    // Backing out of something should look like a different kind of act rather
    // than a lesser version of going ahead with it.
    const primary = render(<Button>Yes</Button>);
    const quiet = render(<Button weight="quiet">No</Button>);

    expect(primary).toContain('var(--accent-accent)');
    expect(quiet).toContain('var(--ink-muted)');
    expect(quiet).not.toContain('var(--accent-accent)');
  });

  it('moves for exactly as long as the application says', () => {
    expect(render(<Button>Yes</Button>)).toContain('var(--duration-enter)');
  });

  it('passes everything else through', () => {
    const markup = render(
      <Button disabled aria-label="Record what you wrote">
        Record it
      </Button>,
    );

    expect(markup).toContain('disabled');
    expect(markup).toContain('aria-label="Record what you wrote"');
  });
});

describe('a caller nudging one thing', () => {
  it('keeps everything it did not ask to change', () => {
    // Spreading the caller's style with the rest of the props would replace the
    // button's whole appearance, and the caller would have no idea.
    const markup = render(<Button style={{ justifySelf: 'start' }}>Record it</Button>);

    expect(markup).toContain('justify-self:start');
    expect(markup).toContain('var(--accent-accent)');
  });

  it('lets a caller override one value on purpose', () => {
    const markup = render(<Button style={{ cursor: 'wait' }}>Recording</Button>);

    expect(markup).toContain('cursor:wait');
    expect(markup).not.toContain('cursor:pointer');
  });
});
