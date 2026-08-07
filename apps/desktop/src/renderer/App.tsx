import { useCallback, useEffect, useRef, useState } from 'react';

import { Button, slot, TABULAR_NUMERALS, tokens, WritingSurface } from '@aether-forge/ui';

import type {
  CheckView,
  JournalEntryView,
  OfferAnswer,
  RunCheckRequest,
  TimelineItem,
} from '../shared/ipc';
import { CheckCard } from './CheckCard';
import { Entry } from './Entry';
import { RunACheck } from './RunACheck';

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
  const [items, setItems] = useState<readonly TimelineItem[] | null>(null);
  const [checks, setChecks] = useState<readonly CheckView[]>([]);
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

    void window.aetherForge.readTimeline().then((timeline) => {
      if (timeline.ok) setItems(timeline.value.items);
      else setProblem(timeline.failure.detail);
    });

    void window.aetherForge.readChecks().then((declared) => {
      if (declared.ok) setChecks(declared.value.checks);
      else setProblem(declared.failure.detail);
    });
  }, []);

  // Opening a campaign should land you where you left off, at the end of what
  // you have written, not at the beginning of it.
  useEffect(() => {
    end.current?.scrollIntoView();
  }, [items]);

  const startCorrecting = useCallback((entry: JournalEntryView) => {
    setCorrecting(entry.id);
    setCorrection(entry.text);
    setProblem(null);
  }, []);

  const stopCorrecting = useCallback(() => {
    setCorrecting(null);
    setCorrection('');
  }, []);

  /**
   * Ask for the whole campaign again.
   *
   * Used after anything that writes more than one event. A check writes four,
   * and an answer writes two, and reassembling that in the window would be a
   * second implementation of what the timeline already works out. The campaign
   * is small enough that reading it is cheaper than keeping two copies in step.
   */
  const reread = useCallback(async () => {
    const timeline = await window.aetherForge.readTimeline();
    if (timeline.ok) setItems(timeline.value.items);
    else setProblem(timeline.failure.detail);
  }, []);

  const runACheck = useCallback(
    async (request: RunCheckRequest) => {
      setBusy(true);
      try {
        const ran = await window.aetherForge.runCheck(request);
        if (ran.ok) {
          await reread();
          setProblem(null);
        } else {
          setProblem(ran.failure.detail);
        }
      } finally {
        setBusy(false);
      }
    },
    [reread],
  );

  const answerAnOffer = useCallback(
    async (offerId: string, answer: OfferAnswer) => {
      setBusy(true);
      try {
        const answered = await window.aetherForge.answerOffer({ offerId, answer });
        if (answered.ok) {
          await reread();
          setProblem(null);
        } else {
          setProblem(answered.failure.detail);
        }
      } finally {
        setBusy(false);
      }
    },
    [reread],
  );

  const saveCorrection = useCallback(async () => {
    if (correcting === null) return;

    setBusy(true);
    try {
      const corrected = await window.aetherForge.correctEntry(correcting, correction);
      if (corrected.ok) {
        // Nothing was edited. A correction was appended, so the campaign is
        // read again rather than patched in place.
        await reread();
        stopCorrecting();
        setProblem(null);
      } else {
        setProblem(corrected.failure.detail);
      }
    } finally {
      setBusy(false);
    }
  }, [correcting, correction, reread, stopCorrecting]);

  const record = useCallback(async () => {
    setBusy(true);
    try {
      const recorded = await window.aetherForge.recordEntry(text);
      if (recorded.ok) {
        await reread();
        setText('');
        setProblem(null);
      } else {
        setProblem(recorded.failure.detail);
      }
    } finally {
      setBusy(false);
    }
  }, [reread, text]);

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
          {items === null && <p style={QUIET}>Reading the campaign…</p>}

          {items?.length === 0 && <p style={QUIET}>Nothing written yet.</p>}

          {items?.map((item) =>
            item.kind === 'check' ? (
              <CheckCard
                key={item.check.id}
                check={item.check}
                onAnswer={(offerId, answer) => void answerAnOffer(offerId, answer)}
                busy={busy}
              />
            ) : (
              <Entry
                key={item.entry.id}
                entry={item.entry}
                correcting={correcting}
                correction={correction}
                busy={busy}
                onStart={startCorrecting}
                onStop={stopCorrecting}
                onChange={setCorrection}
                onSave={() => void saveCorrection()}
              />
            ),
          )}
        </section>

        <RunACheck checks={checks} busy={busy} onRun={(request) => void runACheck(request)} />

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
