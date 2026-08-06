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
} as const;

export type Tokens = typeof tokens;
