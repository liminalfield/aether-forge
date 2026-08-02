/**
 * `@aether-forge/ui`: design tokens and (later) the component layer.
 *
 * Imports nothing internal, ever. Subject to the same vocabulary rule as
 * `core`: no rulebook words. System modules contribute their own theme tokens
 * that override these defaults.
 */

export const tokens = {
  space: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '40px' },
  radius: { sm: '2px', md: '6px', lg: '12px' },
  fontSize: { sm: '0.875rem', md: '1rem', lg: '1.25rem', xl: '1.75rem' },
  color: {
    surface: '#101216',
    surfaceRaised: '#181b21',
    text: '#e6e8ec',
    textMuted: '#9aa1ad',
    accent: '#6ea8fe',
    border: '#2a2f38',
  },
} as const;

export type Tokens = typeof tokens;
