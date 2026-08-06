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

export type { Tokens } from './tokens.js';
export { family, TABULAR_NUMERALS, tokens, typeProperties } from './tokens.js';

export type { ButtonProps, ButtonWeight } from './Button.js';
export { Button } from './Button.js';
