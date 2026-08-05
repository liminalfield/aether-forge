import { describe, expect, it } from 'vitest';

import { tokens } from './index.js';
import { customPropertiesFor, glacialDark, slot, SLOTS, type Theme } from './theme.js';

describe('@aether-forge/ui', () => {
  it('exposes a token scale', () => {
    expect(tokens.space.md).toBe('16px');
    expect(tokens.radius.pill).toBe('999px');
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
  it('produces one property per slot', () => {
    const properties = customPropertiesFor(glacialDark);
    expect(Object.keys(properties)).toHaveLength(15);
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
