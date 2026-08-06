/**
 * `@aether-forge/ui`: design tokens, themes and the component layer.
 *
 * Imports nothing internal, ever. Subject to the same vocabulary rule as
 * `core`: no rulebook words.
 *
 * Colour lives in `theme.ts` and reaches components as CSS custom properties.
 * Everything below is fixed: sizes, spacing and the type scale are not a
 * theme's to change, because they are load-bearing in an interface this dense.
 */

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

export type { MotionPreference } from './motion.js';
export {
  duration,
  EASING,
  isMotionPreference,
  MOTION,
  MOTION_PREFERENCES,
  motionProperties,
  shouldAnimate,
} from './motion.js';

export type { Colour, InkContrast, ThemeReport } from './colour.js';
export {
  contrastBetween,
  hueOf,
  hueSeparation,
  luminanceOf,
  over,
  parseColour,
  reportOn,
} from './colour.js';

export type { SlotGroup, SlotName, Theme, ThemeColours } from './theme.js';
export {
  builtInThemes,
  customPropertiesFor,
  emberDark,
  glacialDark,
  slot,
  slotsThatDiffer,
  SLOTS,
} from './theme.js';

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
