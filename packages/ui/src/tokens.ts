/**
 * Sizes, spacing and type. Fixed, and not a theme's to change.
 *
 * These are load-bearing in an interface this dense: a person reconfiguring
 * them would quietly destroy the thing the design is for. See
 * `design/themes-and-components.md`.
 */

export const tokens = {
  space: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '40px' },
  radius: { sm: '3px', md: '6px', lg: '10px', pill: '999px' },
  fontSize: { sm: '0.875rem', md: '1rem', lg: '1.25rem', xl: '1.75rem' },

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
