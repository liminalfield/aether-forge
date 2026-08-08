/**
 * Sizes, spacing and type. Fixed, and not a theme's to change.
 *
 * These are load-bearing in an interface this dense: a person reconfiguring
 * them would quietly destroy the thing the design is for. See
 * `design/themes-and-components.md`.
 *
 * Every size the interface uses has a name here. A component that writes a
 * size by hand is refused by lint, the same way a colour written by hand is,
 * because a scale nobody is held to stops being a scale within a week.
 */

export const tokens = {
  /**
   * Space between things, as the handoff sets it out.
   *
   * Keyed by the number of pixels, so nothing has to remember whether large
   * is bigger than extra-large. Two pixels sits below the scale on purpose:
   * it is the gap between things that are almost touching, like the pair of
   * step buttons on a track.
   */
  space: {
    2: '2px',
    4: '4px',
    8: '8px',
    12: '12px',
    16: '16px',
    24: '24px',
    32: '32px',
    48: '48px',
    64: '64px',
  },

  radius: { sm: '3px', md: '6px', lg: '10px', pill: '999px' },

  /**
   * Type sizes, named for the job each does rather than for how big it is.
   *
   * The design uses more sizes than a tidy scale would, because a dense
   * interface needs them: a die face and a small caps label are both
   * "numeric" and could not be further apart.
   */
  type: {
    /** The smallest caps labels, in the title bar and above fields. */
    micro: '10.5px',
    /** Settled lines and provenance strips. */
    tiny: '11px',
    /** Chips, and small numbers beside them. */
    small: '12px',
    /** Rail entries and form fields. */
    compact: '13px',
    /** The interface's ordinary size: card names, buttons. */
    base: '14px',
    /** Outcome summaries, which are read rather than scanned. */
    reading: '15px',
    /** The journal's own writing. */
    prose: '18px',
    /** A stat's value on a sheet. */
    display: '22px',
    /** A die face. */
    figure: '30px',
  },

  /** Letter spacing, which only capitalised labels use. */
  tracking: { caps: '.14em', capsWide: '.16em' },

  lineHeight: { tight: 1.4, normal: 1.5, prose: 1.6 },

  /** Border widths. The heavy one marks an outcome, and nothing else. */
  border: { hair: '1px', emphasis: '2px' },

  /** Fixed dimensions the design sets, rather than the scale deciding. */
  layout: {
    /** The left rail. */
    rail: '210px',
    /** The title bar. */
    titleBar: '38px',
    /** The writing column. Measured in characters, because prose is. */
    column: '60ch',
    /** A box that opens over the page, as the handoff sizes it. */
    palette: '720px',
    /**
     * How tall a list inside that box may grow before it scrolls itself.
     *
     * Without a ceiling a long list pushes the controls under it off the
     * bottom of the window, where nothing can reach them.
     */
    paletteList: '320px',
    /** The writing column's own padding, which the handoff sets by eye. */
    pageTop: '34px',
    pageSide: '40px',
    pageBottom: '46px',
  },

  /**
   * Sizes a single component's own anatomy, where the handoff set them by eye
   * rather than from the scale. Kept apart from `space` so the scale stays a
   * scale.
   */
  box: {
    /** A die face in the result card. */
    die: '30px',
    /** The gap between the result card's three zones. */
    cardGap: '14px',
    /** The result card's padding: down the sides, and top to bottom. */
    cardPadY: '16px',
    cardPadX: '18px',
  },

  /**
   * Three families, each doing one job.
   *
   * `prose` is for anything somebody reads at length. `ui` is for the interface
   * around it. `numeric` is for anything that is a number: dice, meters, clock
   * readings, and the small capitalised labels that sit beside them.
   *
   * The families are named here and their files are supplied by the
   * application, in the same way core says what a log must do and the
   * application supplies the storage. A library that shipped its own binaries
   * would need a build step it does not have and has no reason to grow.
   */
  font: {
    prose: "'Literata', Georgia, serif",
    ui: "'Archivo', system-ui, sans-serif",
    numeric: "'IBM Plex Mono', ui-monospace, monospace",
  },

  /**
   * Weights the prose surface uses. It lightens on a dark ground and firms up
   * on a light one, because thin serif type on a bright ground loses its
   * stroke.
   */
  proseWeight: { onDark: 300, onLight: 400 },
} as const;

/**
 * Every number a person reads has to hold still.
 *
 * A figure that changes width when it changes value is unreadable in a rail,
 * and a meter counting down redraws its own label sideways while you watch it.
 * Applied wherever a number is shown rather than argued about per component.
 */
export const TABULAR_NUMERALS = { fontVariantNumeric: 'tabular-nums' } as const;

export type Tokens = typeof tokens;

/**
 * The typefaces, as custom properties.
 *
 * Not part of a theme: a theme is colour, and these do not change with one.
 * They travel the same way colour does so that a stylesheet and a component
 * name them identically, and neither has to repeat the family list.
 */
export function typeProperties(): Readonly<Record<string, string>> {
  return {
    '--font-prose': tokens.font.prose,
    '--font-ui': tokens.font.ui,
    '--font-numeric': tokens.font.numeric,
  };
}

/** The property a family lives in, so nothing writes the name by hand. */
export function family(role: keyof Tokens['font']): string {
  return `var(--font-${role})`;
}
