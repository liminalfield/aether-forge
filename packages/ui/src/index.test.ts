import { describe, expect, it } from 'vitest';

import {
  duration,
  EASING,
  isMotionPreference,
  MOTION,
  motionProperties,
  shouldAnimate,
  tokens,
} from './index.js';
import {
  builtInThemes,
  customPropertiesFor,
  emberDark,
  glacialDark,
  slot,
  slotsThatDiffer,
  SLOTS,
  type Theme,
} from './theme.js';

describe('@aether-forge/ui', () => {
  it('exposes a token scale', () => {
    expect(tokens.space[16]).toBe('16px');
    expect(tokens.radius.pill).toBe('999px');
  });

  it('spaces things by the eight steps the handoff sets out', () => {
    // A scale that skips steps sends a component looking for a raw value, and
    // the lint rule then stops it with nowhere to go.
    expect(Object.values(tokens.space)).toEqual([
      '2px',
      '4px',
      '8px',
      '12px',
      '16px',
      '24px',
      '32px',
      '48px',
      '64px',
    ]);
  });

  it('names a type size for every size the design actually uses', () => {
    // Nine, which is more than a tidy scale would have. A dense interface
    // needs them: a die face and a caps label are both numeric type.
    expect(Object.keys(tokens.type)).toHaveLength(9);
    expect(tokens.type.base).toBe('14px');
    expect(tokens.type.prose).toBe('18px');
  });

  it('holds no colour outside a theme', () => {
    // Colour reaches a component as a custom property. A palette sitting here
    // as well would be a second place to change one, and the two would drift.
    expect(tokens).not.toHaveProperty('color');
    expect(JSON.stringify(tokens)).not.toMatch(/#[0-9a-f]{3,8}/i);
  });
});

describe('the slots a theme fills', () => {
  it('has fifteen of them', () => {
    // Counted so that adding or removing one is a deliberate act. The handoff
    // said fourteen because it treated the match colour as locked rather than
    // as a slot. It is unlocked, so there are fifteen.
    const count = Object.values(SLOTS).reduce((total, names) => total + names.length, 0);
    expect(count).toBe(15);
  });

  it('names its groups', () => {
    expect(Object.keys(SLOTS)).toEqual(['ground', 'ink', 'accent', 'outcome']);
  });
});

describe('reaching a colour', () => {
  it('gives the custom property a slot lives in', () => {
    expect(slot('ground', 'raised')).toBe('var(--ground-raised)');
    expect(slot('outcome', 'match')).toBe('var(--outcome-match)');
  });

  it('is the only way a component should name one', () => {
    // The point of the accessor: a hand-written property name is a string, and
    // a typo in a string renders wrong in silence. This does not compile:
    //
    //   slot('ground', 'raisd')
    //
    // @ts-expect-error a slot that does not exist is a build failure
    slot('ground', 'raisd');
  });
});

describe('turning a theme into properties', () => {
  it('produces one property per slot, plus the two it mixes from the accent', () => {
    // Fifteen authored values, and two the ghost block needs that nobody
    // authors: a theme changing its accent changes both with it.
    const properties = customPropertiesFor(glacialDark);
    const authored = Object.keys(properties).filter((name) => !name.startsWith('--ghost-'));

    expect(authored).toHaveLength(15);
    expect(Object.keys(properties)).toHaveLength(17);
  });

  it('names them the way the accessor asks for them', () => {
    const properties = customPropertiesFor(glacialDark);

    for (const group of Object.keys(SLOTS) as (keyof typeof SLOTS)[]) {
      for (const name of SLOTS[group]) {
        const property = slot(group, name)
          .replace(/^var\(/, '')
          .replace(/\)$/, '');
        expect(properties, `${group}.${name} is missing`).toHaveProperty(property);
      }
    }
  });

  it('carries the values the theme gave it', () => {
    const properties = customPropertiesFor(glacialDark);
    expect(properties['--ground-void']).toBe('#05080E');
    expect(properties['--ink-hairline']).toBe('rgba(150,180,215,.12)');
    expect(properties['--outcome-match']).toBe('#A98BFF');
  });

  it('gives the same answer for the same theme, in the same order', () => {
    // A theme is data that can arrive from a file. Two runs producing the same
    // properties in a different order would make anything comparing them wrong.
    expect(Object.keys(customPropertiesFor(glacialDark))).toEqual(
      Object.keys(customPropertiesFor(glacialDark)),
    );
  });

  it('works for any theme, not only the built-in one', () => {
    const nonsense: Theme = {
      name: 'Nonsense',
      ground: { void: 'a', sunken: 'b', base: 'c', raised: 'd', overlay: 'e' },
      ink: { primary: 'f', secondary: 'g', muted: 'h', hairline: 'i' },
      accent: { accent: 'j', pressure: 'k' },
      outcome: { strong: 'l', weak: 'm', miss: 'n', match: 'o' },
    };

    expect(customPropertiesFor(nonsense)['--accent-pressure']).toBe('k');
  });
});

describe('a theme is a palette and never new component design', () => {
  it('produces exactly the same properties whichever theme it is', () => {
    // The claim the whole design system rests on, and the only assertion here
    // that really proves it. If two themes ever produced different property
    // names, something drawing would have to know which theme was in use.
    expect(Object.keys(customPropertiesFor(glacialDark))).toEqual(
      Object.keys(customPropertiesFor(emberDark)),
    );
  });

  it('moves twelve values between glacial and ember, and nothing else', () => {
    // Twelve, not the eleven the handoff claimed. It counted the five ground
    // slots, four ink and two accent, and did not count outcome.miss, which it
    // also rotates. Asserted rather than quoted so the number cannot drift.
    expect(slotsThatDiffer(glacialDark, emberDark)).toEqual([
      '--ground-void',
      '--ground-sunken',
      '--ground-base',
      '--ground-raised',
      '--ground-overlay',
      '--ink-primary',
      '--ink-secondary',
      '--ink-muted',
      '--ink-hairline',
      '--accent-accent',
      '--accent-pressure',
      '--outcome-miss',
      // Mixed from the accent, so they move when it does. Not a thirteenth
      // and fourteenth authored value.
      '--ghost-border',
      '--ghost-wash',
    ]);
  });

  it('keeps strong, weak and match meaning the same thing in both', () => {
    // An outcome that reads the same whichever system you are playing is worth
    // more than a warmer green.
    for (const name of ['strong', 'weak', 'match'] as const) {
      expect(glacialDark.outcome[name], name).toBe(emberDark.outcome[name]);
    }
  });

  it('says a theme differs from itself in nothing at all', () => {
    expect(slotsThatDiffer(glacialDark, glacialDark)).toEqual([]);
  });
});

describe('the themes that ship', () => {
  it('lists them', () => {
    expect(builtInThemes.map((theme) => theme.name)).toEqual(['Glacial dark', 'Ember dark']);
  });

  it('gives every one of them all fifteen slots', () => {
    for (const theme of builtInThemes) {
      const authored = Object.keys(customPropertiesFor(theme)).filter(
        (name) => !name.startsWith('--ghost-'),
      );
      expect(authored, theme.name).toHaveLength(15);
    }
  });

  it('gives every one of them a value in every slot', () => {
    for (const theme of builtInThemes) {
      for (const [property, value] of Object.entries(customPropertiesFor(theme))) {
        expect(value, `${theme.name} ${property}`).not.toBe('');
      }
    }
  });
});

describe('how much the application moves', () => {
  it('offers three durations and one curve', () => {
    // Three, and the ambient ghost pulse is deliberately not a fourth: these
    // say how long a change takes, and that says how slowly something already
    // on screen breathes.
    expect(Object.keys(MOTION)).toEqual(['enter', 'settle', 'ceremony']);
    expect(EASING).toBe('cubic-bezier(.2,.8,.2,1)');
  });

  it('follows the system until somebody says otherwise', () => {
    expect(shouldAnimate('follow-the-system', false)).toBe(true);
    expect(shouldAnimate('follow-the-system', true)).toBe(false);
  });

  it('lets a person override the system in either direction', () => {
    // Someone who has turned reduced motion on system-wide may still want this
    // one application to move, and someone whose system says nothing may still
    // want it still.
    expect(shouldAnimate('on', true)).toBe(true);
    expect(shouldAnimate('off', false)).toBe(false);
  });

  it('removes nothing when it is turned off', () => {
    // Reduced motion means less movement, not less information. Every property
    // is present either way, so a component asking for one always gets an
    // answer and a moment that deserves marking is still marked.
    expect(Object.keys(motionProperties(false))).toEqual(Object.keys(motionProperties(true)));
  });

  it('zeroes the durations and keeps the curve', () => {
    expect(motionProperties(false)).toEqual({
      '--duration-enter': '0ms',
      '--duration-settle': '0ms',
      '--duration-ceremony': '0ms',
      '--easing': EASING,
      // The one thing that stops rather than shortening. A pulse in zero
      // milliseconds is a flash, which is worse than the movement it replaces.
      '--pulse-ghost': 'none',
    });
  });

  it('names a duration without anything writing the property by hand', () => {
    expect(duration('ceremony')).toBe('var(--duration-ceremony)');
    // @ts-expect-error a duration that does not exist is a build failure
    duration('flourish');
  });

  it.each([
    ['a value nobody declared', 'sideways'],
    ['a number', 7],
    ['nothing', undefined],
    ['null', null],
  ])('refuses %s as a preference', (_name, value) => {
    expect(isMotionPreference(value)).toBe(false);
  });
});
