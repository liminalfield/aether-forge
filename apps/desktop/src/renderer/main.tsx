import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import {
  customPropertiesFor,
  GHOST_KEYFRAMES,
  glacialDark,
  isMotionPreference,
  motionProperties,
  shouldAnimate,
  typeProperties,
} from '@aether-forge/ui';

import './fonts.css';

import { App } from './App';

/**
 * Colour reaches components as custom properties, so a theme is applied once,
 * here, rather than threaded through anything that draws. Changing theme later
 * is this same loop with different values, and nothing that has already
 * rendered has to know.
 */
function apply(properties: Readonly<Record<string, string>>): void {
  for (const [property, value] of Object.entries(properties)) {
    document.documentElement.style.setProperty(property, value);
  }
}

apply({ ...customPropertiesFor(glacialDark), ...typeProperties() });

/**
 * Keyframes, which a style attribute cannot hold.
 *
 * Everything else a component needs travels as a custom property, and a
 * property can carry which animation runs and for how long. It cannot carry
 * the animation itself, so the one component with an animation ships its
 * keyframes as text and the application puts them where the page can see
 * them, once.
 */
const keyframes = document.createElement('style');
keyframes.textContent = GHOST_KEYFRAMES;
document.head.append(keyframes);

/**
 * How much the application moves.
 *
 * The system's own setting decides until a person says otherwise, and their
 * answer is read from where the application keeps it rather than from a theme,
 * because how much movement someone can tolerate is theirs.
 *
 * A default is applied at once so nothing is unset while the answer is being
 * fetched, and the fetched answer replaces it. Both paths set every property,
 * so no component ever finds one missing.
 */
const systemAsksForLess = window.matchMedia('(prefers-reduced-motion: reduce)');

function applyMotion(preference: string): void {
  const chosen = isMotionPreference(preference) ? preference : 'follow-the-system';
  apply(motionProperties(shouldAnimate(chosen, systemAsksForLess.matches)));
}

applyMotion('follow-the-system');

void window.aetherForge.readPreferences().then((preferences) => {
  if (preferences.ok) applyMotion(preferences.value.motion);
});

// Somebody changing the system setting while the application is open should not
// have to restart it to be listened to.
systemAsksForLess.addEventListener('change', () => {
  void window.aetherForge.readPreferences().then((preferences) => {
    applyMotion(preferences.ok ? preferences.value.motion : 'follow-the-system');
  });
});

const container = document.getElementById('root');
if (!container) throw new Error('Renderer root element is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
