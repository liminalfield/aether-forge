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
const primaryButton = {
  background: tokens.color.accent,
  color: tokens.color.surface,
  border: 'none',
  borderRadius: tokens.radius.md,
  padding: `${tokens.space.sm} ${tokens.space.md}`,
  font: 'inherit',
  fontWeight: 600,
  cursor: 'pointer',
} as const;

const quietButton = {
  background: 'none',
  color: tokens.color.textMuted,
  border: `1px solid ${tokens.color.border}`,
  borderRadius: tokens.radius.md,
  padding: `${tokens.space.sm} ${tokens.space.md}`,
  font: 'inherit',
  cursor: 'pointer',
} as const;

export function App(): React.JSX.Element {
  const [version, setVersion] = useState<string | null>(null);
  const [entries, setEntries] = useState<readonly JournalEntryView[] | null>(null);
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  /** The entry being changed, if any, and what it will say. */
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [correction, setCorrection] = useState('');

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

  const startCorrecting = useCallback((entry: JournalEntryView) => {
    setCorrecting(entry.id);
    setCorrection(entry.text);
    setProblem(null);
  }, []);

  const stopCorrecting = useCallback(() => {
    setCorrecting(null);
    setCorrection('');
  }, []);

  const saveCorrection = useCallback(async () => {
    if (correcting === null) return;

    setBusy(true);
    try {
      const corrected = await window.aetherForge.correctEntry(correcting, correction);
      if (corrected.ok) {
        // Nothing was edited. What came back is the entry as it now stands,
        // after a correction was appended to the log.
        setEntries((shown) =>
          (shown ?? []).map((entry) => (entry.id === corrected.value.id ? corrected.value : entry)),
        );
        stopCorrecting();
        setProblem(null);
      } else {
        setProblem(corrected.failure.detail);
      }
    } finally {
      setBusy(false);
    }
  }, [correcting, correction, stopCorrecting]);

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
            {correcting === entry.id ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveCorrection();
                }}
                style={{ display: 'grid', gap: tokens.space.sm }}
              >
                <textarea
                  data-testid="correction"
                  aria-label="Change what this says"
                  value={correction}
                  rows={4}
                  autoFocus
                  onChange={(event) => setCorrection(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') stopCorrecting();
                  }}
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
                <div style={{ display: 'flex', gap: tokens.space.sm }}>
                  <button type="submit" disabled={busy} style={primaryButton}>
                    Save
                  </button>
                  <button type="button" onClick={stopCorrecting} style={quietButton}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                {/*
                  A button rather than a paragraph with a click handler, so it
                  can be reached and used from the keyboard without inventing
                  anything.
                */}
                <button
                  type="button"
                  data-testid="entry-text"
                  title="Change what this says"
                  onClick={() => startCorrecting(entry)}
                  style={{
                    display: 'block',
                    width: '100%',
                    margin: 0,
                    padding: 0,
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    font: 'inherit',
                    textAlign: 'left',
                    whiteSpace: 'pre-wrap',
                    cursor: 'text',
                  }}
                >
                  {entry.text}
                </button>
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
              </>
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
        <button type="submit" disabled={busy} style={{ ...primaryButton, justifySelf: 'start' }}>
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
