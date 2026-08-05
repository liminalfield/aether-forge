import { useCallback, useEffect, useRef, useState } from 'react';

import { tokens } from '@aether-forge/ui';

import type { JournalEntryView } from '../shared/ipc';

/**
 * The campaign as a document: oldest at the top, newest at the bottom, and the
 * place you write at the end. It should read the way it was written.
 *
 * The presentation here is deliberately plain. The behaviour is the point, and
 * the markup is kept simple so that a real design can replace the styling
 * without touching any of it.
 */
export function App(): React.JSX.Element {
  const [version, setVersion] = useState<string | null>(null);
  const [entries, setEntries] = useState<readonly JournalEntryView[] | null>(null);
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.aetherForge
      .getAppVersion()
      .then(setVersion)
      .catch((cause: unknown) => setProblem(String(cause)));

    void window.aetherForge.readJournal().then((journal) => {
      if (journal.ok) setEntries(journal.value.entries);
      else setProblem(journal.failure.detail);
    });
  }, []);

  // Opening a campaign should land you where you left off, at the end of what
  // you have written, not at the beginning of it.
  useEffect(() => {
    end.current?.scrollIntoView();
  }, [entries]);

  const record = useCallback(async () => {
    setBusy(true);
    try {
      const recorded = await window.aetherForge.recordEntry(text);
      if (recorded.ok) {
        // The answer carries the entry that was written, so there is no need to
        // ask for the whole journal again.
        setEntries((written) => [...(written ?? []), recorded.value]);
        setText('');
        setProblem(null);
      } else {
        setProblem(recorded.failure.detail);
      }
    } finally {
      setBusy(false);
    }
  }, [text]);

  return (
    <main
      style={{
        minHeight: '100vh',
        margin: '0 auto',
        maxWidth: '70ch',
        padding: tokens.space.xl,
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.space.lg,
        background: tokens.color.surface,
        color: tokens.color.text,
        fontFamily: 'system-ui, sans-serif',
        lineHeight: 1.6,
      }}
    >
      <header>
        <h1 style={{ fontSize: tokens.fontSize.xl, margin: 0 }}>Aether Forge</h1>
        <p style={{ color: tokens.color.textMuted, margin: `${tokens.space.xs} 0 0` }}>
          {version === null ? 'Connecting…' : `Version ${version}`}
        </p>
      </header>

      <section data-testid="journal" style={{ display: 'grid', gap: tokens.space.md }}>
        {entries === null && <p style={{ color: tokens.color.textMuted }}>Reading the campaign…</p>}

        {entries?.length === 0 && (
          <p style={{ color: tokens.color.textMuted }}>Nothing written yet.</p>
        )}

        {entries?.map((entry) => (
          <article key={entry.id} data-testid="entry">
            <p data-testid="entry-text" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {entry.text}
            </p>
            {entry.corrections > 0 && (
              <p
                data-testid="edited"
                title={`Corrected ${entry.corrections} ${entry.corrections === 1 ? 'time' : 'times'}`}
                style={{
                  margin: `${tokens.space.xs} 0 0`,
                  color: tokens.color.textMuted,
                  fontSize: tokens.fontSize.sm,
                }}
              >
                edited
              </p>
            )}
          </article>
        ))}
      </section>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void record();
        }}
        style={{ display: 'grid', gap: tokens.space.sm }}
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

      {problem !== null && (
        <p data-testid="problem" role="alert" style={{ color: '#ff8f8f', margin: 0 }}>
          {problem}
        </p>
      )}

      <div ref={end} />
    </main>
  );
}
