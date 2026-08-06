import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { customPropertiesFor, glacialDark, typeProperties } from '@aether-forge/ui';

import './fonts.css';

import { App } from './App';

/**
 * Colour reaches components as custom properties, so a theme is applied once,
 * here, rather than threaded through anything that draws. Changing theme later
 * is this same loop with different values, and nothing that has already
 * rendered has to know.
 */
for (const [property, value] of Object.entries({
  ...customPropertiesFor(glacialDark),
  ...typeProperties(),
})) {
  document.documentElement.style.setProperty(property, value);
}

const container = document.getElementById('root');
if (!container) throw new Error('Renderer root element is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
