import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { GHOST_KEYFRAMES, GhostBlock } from './GhostBlock.js';
import { motionProperties } from './motion.js';
import { customPropertiesFor, glacialDark } from './theme.js';

describe('the ghost block', () => {
  it('marks a suggestion with dashes, not with colour alone', () => {
    // The load-bearing part. Anyone whose palette or eyesight makes the accent
    // hard to pick out still sees that this has not been decided.
    const markup = renderToStaticMarkup(<GhostBlock>Take the offered change</GhostBlock>);

    expect(markup).toContain('dashed');
  });

  it('names no colour of its own, so a theme reaches it', () => {
    const markup = renderToStaticMarkup(<GhostBlock>Take the offered change</GhostBlock>);

    expect(markup).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(markup).toContain('var(--ghost-border)');
    expect(markup).toContain('var(--ghost-wash)');
  });

  it('takes its movement from a property, so a preference can stop it', () => {
    expect(renderToStaticMarkup(<GhostBlock>x</GhostBlock>)).toContain('var(--pulse-ghost)');
  });

  it('lets a caller lay it out without restating what it looks like', () => {
    const markup = renderToStaticMarkup(<GhostBlock style={{ display: 'grid' }}>x</GhostBlock>);

    expect(markup).toContain('display:grid');
    expect(markup).toContain('dashed');
  });
});

describe('what the pulse does about a person who wants less movement', () => {
  it('breathes when movement is allowed', () => {
    expect(motionProperties(true)['--pulse-ghost']).toContain('ghost-pulse');
  });

  it('does not run at all when it is not, rather than running instantly', () => {
    // A pulse played in zero milliseconds is a flash, which is worse than the
    // movement it replaces. The border and wash stay, so the meaning survives.
    expect(motionProperties(false)['--pulse-ghost']).toBe('none');
  });

  it('names the keyframes the properties refer to', () => {
    expect(GHOST_KEYFRAMES).toContain('@keyframes ghost-pulse');
  });
});

describe('the colours the ghost block mixes', () => {
  it('derives both from the accent a theme authored, not from a sixteenth slot', () => {
    const properties = customPropertiesFor(glacialDark);

    expect(properties['--ghost-border']).toContain(properties['--accent-accent'] ?? 'nothing');
    expect(properties['--ghost-wash']).toContain(properties['--accent-accent'] ?? 'nothing');
  });

  it('leaves a theme with fifteen slots and no more', () => {
    // A theme authors fifteen values. These two are worked out from one of
    // them, so changing the accent changes both, which is the point.
    const authored = Object.keys(customPropertiesFor(glacialDark)).filter(
      (property) => !property.startsWith('--ghost-'),
    );

    expect(authored).toHaveLength(15);
  });
});
