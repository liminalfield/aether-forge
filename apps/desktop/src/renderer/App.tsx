import { useCallback, useEffect, useState } from 'react';

import { tokens } from '@aether-forge/ui';

/**
 * The whole application so far: write something down, and see that the campaign
 * recorded it.
 *
 * There is no editor, no formatting and no way to read entries back yet. Its
 * job is to prove the path from a window with no filesystem access, across the
 * IPC contract, into an append-only log on disk, and back. Everything else is
 * built on that path working.
 */
export function App(): React.JSX.Element {
  const [version, setVersion] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshCount = useCallback(async () => {
    const counted = await window.aetherForge.countEvents();
    if (counted.ok) {
      setCount(counted.value);
      setProblem(null);
    } else {
      setProblem(counted.failure.detail);
    }
  }, []);

  useEffect(() => {
    window.aetherForge
      .getAppVersion()
      .then(setVersion)
      .catch((cause: unknown) => setProblem(String(cause)));
    void refreshCount();
  }, [refreshCount]);

  const record = useCallback(async () => {
    setBusy(true);
    try {
      const recorded = await window.aetherForge.recordEntry(text);
      if (recorded.ok) {
        setText('');
        setProblem(null);
        await refreshCount();
      } else {
        setProblem(recorded.failure.detail);
      }
    } finally {
      setBusy(false);
    }
  }, [text, refreshCount]);

  return (
    <main
      style={{
        minHeight: '100vh',
        margin: 0,
        display: 'grid',
        placeContent: 'center',
        gap: tokens.space.lg,
        padding: tokens.space.xl,
        background: tokens.color.surface,
        color: tokens.color.text,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <header style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: tokens.fontSize.xl, margin: 0 }}>Aether Forge</h1>
        <p style={{ color: tokens.color.textMuted, margin: `${tokens.space.xs} 0 0` }}>
          {version === null ? 'Connecting…' : `Version ${version}`}
        </p>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void record();
        }}
        style={{ display: 'grid', gap: tokens.space.sm, width: 'min(60ch, 80vw)' }}
      >
        <label htmlFor="entry" style={{ color: tokens.color.textMuted }}>
          What happened?
        </label>
        <textarea
          id="entry"
          value={text}
          rows={4}
          onChange={(event) => setText(event.target.value)}
          style={{
            background: tokens.color.surfaceRaised,
            color: tokens.color.text,
            border: `1px solid ${tokens.color.border}`,
            borderRadius: tokens.radius.md,
            padding: tokens.space.sm,
            font: 'inherit',
            resize: 'vertical',
          }}
        />
        <button
          type="submit"
          disabled={busy}
          style={{
            background: tokens.color.accent,
            color: tokens.color.surface,
            border: 'none',
            borderRadius: tokens.radius.md,
            padding: `${tokens.space.sm} ${tokens.space.md}`,
            font: 'inherit',
            fontWeight: 600,
            cursor: 'pointer',
            justifySelf: 'start',
          }}
        >
          Record it
        </button>
      </form>

      <p data-testid="event-count" style={{ color: tokens.color.textMuted, margin: 0 }}>
        {count === null ? 'Reading the campaign…' : `${count} events recorded`}
      </p>

      {problem !== null && (
        <p data-testid="problem" role="alert" style={{ color: '#ff8f8f', margin: 0 }}>
          {problem}
        </p>
      )}
    </main>
  );
}
