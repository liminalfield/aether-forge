import { useEffect, useState } from 'react';

import { tokens } from '@aether-forge/ui';

/**
 * Bootstrap shell. No feature code. Its only job is to prove the IPC round
 * trip and the design-token import work in both dev and a packaged build.
 */
export function App(): React.JSX.Element {
  const [version, setVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.aetherForge
      .getAppVersion()
      .then(setVersion)
      .catch((cause: unknown) => setError(String(cause)));
  }, []);

  return (
    <main
      style={{
        minHeight: '100vh',
        margin: 0,
        display: 'grid',
        placeContent: 'center',
        gap: tokens.space.md,
        background: tokens.color.surface,
        color: tokens.color.text,
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: tokens.fontSize.xl, margin: 0 }}>Aether Forge</h1>
      <p style={{ color: tokens.color.textMuted, margin: 0 }}>
        {error ?? (version === null ? 'Connecting…' : `Version ${version}`)}
      </p>
    </main>
  );
}
