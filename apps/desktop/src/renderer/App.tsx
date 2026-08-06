import { useCallback, useEffect, useRef, useState } from 'react';

import { Button, slot, TABULAR_NUMERALS, tokens, WritingSurface } from '@aether-forge/ui';

import type { JournalEntryView } from '../shared/ipc';

/**
 * The campaign as a document: oldest at the top, newest at the bottom, and the
 * place you write at the end. It should read the way it was written.
 *
 * The centre column of the design, and only that. The rails on either side hold
 * threads, entities and tracks, none of which exist, and an empty rail is worse
 * than no rail.
 */
/** Numbers hold still, so a value changing does not shift what is beside it. */
const TABULAR = { ...TABULAR_NUMERALS } as const;

/** Anything the application says about itself rather than about the campaign. */
const QUIET = {
  color: slot('ink', 'muted'),
  fontFamily: 'var(--font-ui)',
  fontSize: tokens.fontSize.sm,
  margin: 0,
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
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateRows: '38px 1fr',
        background: slot('ground', 'base'),
        color: slot('ink', 'primary'),
      }}
    >
      {/*
        The title bar carries what a person needs at a glance and nothing they
        have to read: where they are, and how far the campaign has got.
      */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `0 ${tokens.space.lg}`,
          borderBottom: `1px solid ${slot('ink', 'hairline')}`,
          background: slot('ground', 'sunken'),
          fontFamily: 'var(--font-numeric)',
          fontSize: '10.5px',
          letterSpacing: '.16em',
          textTransform: 'uppercase',
          color: slot('ink', 'muted'),
        }}
      >
        <span>Aether Forge</span>
        <span data-testid="version" style={TABULAR}>
          {version === null ? 'connecting' : `v${version}`}
        </span>
      </header>

      <main
        style={{
          margin: '0 auto',
          width: '100%',
          maxWidth: '60ch',
          padding: `34px ${tokens.space.xl} 46px`,
          display: 'flex',
          flexDirection: 'column',
          gap: tokens.space.xl,
        }}
      >
        <section data-testid="journal" style={{ display: 'grid', gap: tokens.space.lg }}>
          {entries === null && <p style={QUIET}>Reading the campaign…</p>}

          {entries?.length === 0 && <p style={QUIET}>Nothing written yet.</p>}

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
                  <WritingSurface
                    label="Change what this says"
                    showLabel={false}
                    data-testid="correction"
                    value={correction}
                    rows={4}
                    autoFocus
                    onChange={(event) => setCorrection(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') stopCorrecting();
                    }}
                  />
                  <div style={{ display: 'flex', gap: tokens.space.sm }}>
                    <Button type="submit" disabled={busy}>
                      Save
                    </Button>
                    <Button weight="quiet" onClick={stopCorrecting}>
                      Cancel
                    </Button>
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
                      color: slot('ink', 'primary'),
                      fontFamily: 'var(--font-prose)',
                      fontSize: '18px',
                      fontWeight: 300,
                      lineHeight: 1.6,
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
                        color: slot('ink', 'muted'),
                        fontFamily: 'var(--font-numeric)',
                        fontSize: '10.5px',
                        letterSpacing: '.16em',
                        textTransform: 'uppercase',
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
          <WritingSurface
            id="entry"
            label="What happened?"
            value={text}
            rows={4}
            onChange={(event) => setText(event.target.value)}
          />
          <Button type="submit" disabled={busy} style={{ justifySelf: 'start' }}>
            Record it
          </Button>
        </form>

        {problem !== null && (
          <p
            data-testid="problem"
            role="alert"
            style={{ color: slot('outcome', 'miss'), margin: 0 }}
          >
            {problem}
          </p>
        )}

        <div ref={end} />
      </main>
    </div>
  );
}
