import {
  builtInThemes,
  customPropertiesFor,
  glacialDark,
  isMotionPreference,
  motionProperties,
  shouldAnimate,
} from '@aether-forge/ui';

/**
 * Putting colour and movement on the page.
 *
 * Its own module because both the startup path and the window need it, and
 * having the window reach into the startup file would make the two import
 * each other. Nothing here renders anything: it sets custom properties, and
 * whatever has already drawn picks them up without being told.
 */

function apply(properties: Readonly<Record<string, string>>): void {
  for (const [property, value] of Object.entries(properties)) {
    document.documentElement.style.setProperty(property, value);
  }
}

/**
 * Wear a theme, by name.
 *
 * Switching is the same loop with different values. Nothing that has already
 * rendered is told, because nothing that has already rendered knows a colour:
 * it knows a property name, and the property now holds something else.
 *
 * A name this build does not have falls back to the reference theme rather
 * than leaving the window unpainted.
 */
export function wearTheme(name: string): void {
  const chosen = builtInThemes.find((theme) => theme.name === name) ?? glacialDark;
  apply(customPropertiesFor(chosen));
}

const systemAsksForLess = window.matchMedia('(prefers-reduced-motion: reduce)');

/**
 * How much the application moves.
 *
 * The system's own setting decides until a person says otherwise, and their
 * answer is read from where the application keeps it rather than from a theme,
 * because how much movement someone can tolerate is theirs.
 */
export function applyMotion(preference: string): void {
  const chosen = isMotionPreference(preference) ? preference : 'follow-the-system';
  apply(motionProperties(shouldAnimate(chosen, systemAsksForLess.matches)));
}

/** Everything that is not a theme and not a preference: fonts, and the like. */
export function applyOnce(properties: Readonly<Record<string, string>>): void {
  apply(properties);
}

/** Somebody changing the system setting while the application is open. */
export function whenTheSystemChangesItsMind(react: () => void): void {
  systemAsksForLess.addEventListener('change', react);
}
