import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import {
  customPropertiesFor,
  GHOST_KEYFRAMES,
  glacialDark,
  typeProperties,
} from '@aether-forge/ui';

import './fonts.css';

import { App } from './App';
import { applyMotion, applyOnce, wearTheme, whenTheSystemChangesItsMind } from './appearance';

/**
 * The reference theme is applied before anything asks what is stored, so no
 * frame is ever unpainted. What is stored replaces it as soon as it arrives.
 */
applyOnce({ ...customPropertiesFor(glacialDark), ...typeProperties() });

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

// A default at once, so nothing is unset while the stored answer is fetched.
// Both paths set every property, so no component ever finds one missing.
applyMotion('follow-the-system');

void window.aetherForge.readPreferences().then((preferences) => {
  if (!preferences.ok) return;
  applyMotion(preferences.value.motion);
  wearTheme(preferences.value.theme);
});

// Somebody changing the system setting while the application is open should not
// have to restart it to be listened to.
whenTheSystemChangesItsMind(() => {
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
