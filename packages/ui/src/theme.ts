/**
 * Colour, and the one place its names are written down.
 *
 * A theme is colour and nothing else. Not fonts, not sizes, not spacing, and
 * not the shapes of tracks and clocks: this interface is dense with chrome, and
 * those carry meaning that a person reconfiguring them would quietly destroy.
 *
 * Every colour reaches a component as a CSS custom property, never as a value.
 * That is what makes a theme loaded from a file at runtime able to reach code
 * that has already rendered: setting fifteen properties on the root element
 * changes the whole application, and no component knows it happened.
 *
 * See `design/themes-and-components.md`.
 */

/**
 * Every slot, in four groups. The single list this file generates everything
 * else from: the type a theme has to satisfy, the property names, and the
 * accessor components use.
 *
 * Adding a slot here is a deliberate act. A test counts them, so it cannot
 * happen by accident.
 */
export const SLOTS = {
  /** Surfaces, from the deepest to the one furthest forward. */
  ground: ['void', 'sunken', 'base', 'raised', 'overlay'],
  /** Text, and the faint lines between things. */
  ink: ['primary', 'secondary', 'muted', 'hairline'],
  /**
   * `accent` is the player's own progress. `pressure` is the world closing in.
   * A campaign where those two read as the same colour is hard to follow at a
   * glance, which is why the application reports how far apart they are.
   */
  accent: ['accent', 'pressure'],
  /** How a roll turned out. Each also carries a glyph, so colour is never alone. */
  outcome: ['strong', 'weak', 'miss', 'match'],
} as const satisfies Record<string, readonly string[]>;

export type SlotGroup = keyof typeof SLOTS;
export type SlotName<Group extends SlotGroup> = (typeof SLOTS)[Group][number];

/** The colours a theme has to supply, derived from `SLOTS` rather than repeated. */
export type ThemeColours = {
  readonly [Group in SlotGroup]: { readonly [Name in SlotName<Group>]: string };
};

export interface Theme extends ThemeColours {
  /** What it is called, for anything that has to list themes. */
  readonly name: string;
}

/**
 * The custom property a slot lives in.
 *
 * Components call this rather than writing `var(--ground-raised)` by hand. A
 * hand-written property name is a string, and a typo in a string renders the
 * wrong colour without anything complaining. Going through here makes the same
 * typo a build failure.
 */
export function slot<Group extends SlotGroup>(group: Group, name: SlotName<Group>): string {
  return `var(--${group}-${name})`;
}

/**
 * A theme, flattened into the properties that carry it.
 *
 * Returned rather than applied, because core rules apply here too: this is
 * plain computation and something else decides where to put the result.
 */
export function customPropertiesFor(theme: ThemeColours): Readonly<Record<string, string>> {
  const properties: Record<string, string> = {};

  // Walked in the order SLOTS declares rather than the order the object happens
  // to have, so the same theme always produces the same thing.
  for (const group of Object.keys(SLOTS) as SlotGroup[]) {
    for (const name of SLOTS[group]) {
      properties[`--${group}-${name}`] = theme[group][name as never];
    }
  }

  // Two colours nothing authors, mixed from the accent a theme did author.
  //
  // The ghost block needs the accent at two strengths, and neither is a
  // sixteenth slot: a theme still supplies fifteen values, and these are
  // worked out from one of them. A theme author who changes the accent gets
  // both of these changing with it, which is the point.
  properties['--ghost-border'] =
    `color-mix(in srgb, ${properties['--accent-accent'] ?? 'transparent'} 40%, transparent)`;
  properties['--ghost-wash'] =
    `color-mix(in srgb, ${properties['--accent-accent'] ?? 'transparent'} 6%, transparent)`;

  return properties;
}

/**
 * The reference theme, and the one the application opens with.
 *
 * Starlight on ice. Every other theme is this one's structure with different
 * values in it, which is the claim the whole design system rests on.
 */
export const glacialDark: Theme = {
  name: 'Glacial dark',
  ground: {
    void: '#05080E',
    sunken: '#0A0F18',
    base: '#0E1420',
    raised: '#141C2A',
    overlay: '#1B2534',
  },
  ink: {
    primary: '#E8EEF6',
    secondary: '#A8B7CB',
    muted: '#7E92A8',
    hairline: 'rgba(150,180,215,.12)',
  },
  accent: { accent: '#7FD4F5', pressure: '#D9A85C' },
  outcome: { strong: '#8FE3C0', weak: '#D9A85C', miss: '#CE6B75', match: '#A98BFF' },
};

/**
 * Firelight and cold iron, rather than starlight on ice.
 *
 * Structurally identical to the theme above, which is the point. Everything
 * that reads a colour reads the same fifteen properties either way, so nothing
 * that draws has to know which one is in use.
 *
 * Which system prefers which theme is not decided here, and cannot be: this
 * file may not name a game. A module or the application picks a default; a
 * theme is only ever a palette.
 *
 * `sunken` and `base` carry the same value here. That is what the design
 * handoff specifies rather than an oversight in transcription, and it means
 * this theme has one fewer visible step in its ground ramp than the glacial
 * one. Left as given; it is the designer's to change.
 */
export const emberDark: Theme = {
  name: 'Ember dark',
  ground: {
    void: '#100C09',
    sunken: '#1A1310',
    base: '#1A1310',
    raised: '#241A14',
    overlay: '#31241B',
  },
  ink: {
    primary: '#F2EAE0',
    secondary: '#C4B3A2',
    muted: '#9A8B7C',
    hairline: 'rgba(215,190,165,.12)',
  },
  accent: { accent: '#E09A5C', pressure: '#9FC9E8' },
  // Strong, weak and match are not rotated. They read the same against either
  // ground, and an outcome meaning the same thing whichever palette is in use
  // is worth more than a warmer green.
  outcome: { strong: '#8FE3C0', weak: '#D9A85C', miss: '#D0625F', match: '#A98BFF' },
};

/** Every theme the application ships with. */
export const builtInThemes: readonly Theme[] = [glacialDark, emberDark];

/**
 * How many slots differ between two themes.
 *
 * Here because the claim the design system rests on is checkable: a theme is a
 * palette and never new component design. Two themes always produce the same
 * property names, and only the values move.
 */
export function slotsThatDiffer(left: ThemeColours, right: ThemeColours): readonly string[] {
  const before = customPropertiesFor(left);
  const after = customPropertiesFor(right);

  return Object.keys(before).filter((property) => before[property] !== after[property]);
}
