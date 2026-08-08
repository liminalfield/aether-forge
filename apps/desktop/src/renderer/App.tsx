import { useCallback, useEffect, useRef, useState } from 'react';

import { Button, slot, TABULAR_NUMERALS, tokens, WritingSurface } from '@aether-forge/ui';

import type {
  ChecksView,
  CheckView,
  EntitiesView,
  InstalledPackageView,
  EntityTypeView,
  EntityView,
  FieldValueView,
  IpcResult,
  JournalEntryView,
  OfferAnswer,
  RunCheckRequest,
  TimelineItem,
  TimelineView,
} from '../shared/ipc';
import { CheckCard } from './CheckCard';
import { EntitiesRail } from './EntitiesRail';
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
  fontSize: tokens.type.base,
  margin: 0,
} as const;

export function App(): React.JSX.Element {
  const [version, setVersion] = useState<string | null>(null);
  const [items, setItems] = useState<readonly TimelineItem[] | null>(null);
  const [checks, setChecks] = useState<readonly CheckView[]>([]);
  const [held, setHeld] = useState<readonly EntityView[]>([]);
  const [credits, setCredits] = useState<readonly InstalledPackageView[]>([]);
  const [entityTypes, setEntityTypes] = useState<readonly EntityTypeView[]>([]);
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

    void window.aetherForge.readEntities().then((entities) => {
      if (entities.ok) setHeld(entities.value.entities);
      else setProblem(entities.failure.detail);
    });

    void window.aetherForge.describeEntityTypes().then((types) => {
      if (types.ok) setEntityTypes(types.value.types);
      else setProblem(types.failure.detail);
    });

    void window.aetherForge.listPackages().then((held) => {
      if (held.ok) setCredits(held.value.packages);
      else setProblem(held.failure.detail);
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
   *
   * It returns the fresh timeline rather than applying it, and `arrived` sets
   * it in the same synchronous block that releases `busy`. Applied inside this
   * function, the new items rendered one frame before `busy` cleared, and that
   * frame showed a card that looked ready while the keyboard was still being
   * ignored. A key pressed into it vanished without a trace.
   */
  const reread = useCallback(() => window.aetherForge.readTimeline(), []);

  /** What came back from a reread, applied in one render. */
  const arrived = useCallback((timeline: IpcResult<TimelineView>) => {
    if (timeline.ok) {
      setItems(timeline.value.items);
      setProblem(null);
    } else {
      setProblem(timeline.failure.detail);
    }
  }, []);

  /**
   * A fresh reading of the entities and the checks, applied in the same
   * render as busy. The checks come along because a suggestion is computed
   * from the campaign when a check is described, and a character created a
   * moment ago should be suggesting stats without a restart.
   */
  const entitiesArrived = useCallback(
    (entities: IpcResult<EntitiesView>, checks: IpcResult<ChecksView>) => {
      if (entities.ok) {
        setHeld(entities.value.entities);
        setProblem(null);
      } else {
        setProblem(entities.failure.detail);
      }
      if (checks.ok) setChecks(checks.value.checks);
    },
    [],
  );

  const rereadShape = useCallback(async (): Promise<
    [IpcResult<EntitiesView>, IpcResult<ChecksView>]
  > => {
    return Promise.all([window.aetherForge.readEntities(), window.aetherForge.readChecks()]);
  }, []);

  const createAnEntity = useCallback(
    async (request: { entityType?: string; name: string }) => {
      setBusy(true);
      try {
        const made = await window.aetherForge.createEntity({
          ...(request.entityType === undefined ? {} : { entityType: request.entityType }),
          fields: { name: request.name },
        });
        if (made.ok) entitiesArrived(...(await rereadShape()));
        else setProblem(made.failure.detail);
      } finally {
        setBusy(false);
      }
    },
    [entitiesArrived, rereadShape],
  );

  const setAField = useCallback(
    async (entityId: string, fieldId: string, value: FieldValueView) => {
      setBusy(true);
      try {
        const changed = await window.aetherForge.changeEntity({
          entityId,
          fields: { [fieldId]: value },
        });
        if (changed.ok) entitiesArrived(...(await rereadShape()));
        else setProblem(changed.failure.detail);
      } finally {
        setBusy(false);
      }
    },
    [entitiesArrived, rereadShape],
  );

  const importContent = useCallback(async () => {
    setBusy(true);
    try {
      const asked = await window.aetherForge.importPackage();
      if (asked.ok) {
        setCredits(asked.value.listing.packages);
        setProblem(null);
      } else {
        setProblem(asked.failure.detail);
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const advanceATrack = useCallback(
    async (entityId: string, trackId: string, by: number) => {
      setBusy(true);
      try {
        const moved = await window.aetherForge.advanceTrack({ entityId, trackId, by });
        if (moved.ok) entitiesArrived(...(await rereadShape()));
        else setProblem(moved.failure.detail);
      } finally {
        setBusy(false);
      }
    },
    [entitiesArrived, rereadShape],
  );

  const runACheck = useCallback(
    async (request: RunCheckRequest) => {
      setBusy(true);
      try {
        const ran = await window.aetherForge.runCheck(request);
        if (ran.ok) arrived(await reread());
        else setProblem(ran.failure.detail);
      } finally {
        setBusy(false);
      }
    },
    [arrived, reread],
  );

  const answerAnOffer = useCallback(
    async (offerId: string, answer: OfferAnswer) => {
      setBusy(true);
      try {
        const answered = await window.aetherForge.answerOffer({ offerId, answer });
        if (answered.ok) arrived(await reread());
        else setProblem(answered.failure.detail);
      } finally {
        setBusy(false);
      }
    },
    [arrived, reread],
  );

  const saveCorrection = useCallback(async () => {
    if (correcting === null) return;

    setBusy(true);
    try {
      const corrected = await window.aetherForge.correctEntry(correcting, correction);
      if (corrected.ok) {
        // Nothing was edited. A correction was appended, so the campaign is
        // read again rather than patched in place.
        arrived(await reread());
        stopCorrecting();
      } else {
        setProblem(corrected.failure.detail);
      }
    } finally {
      setBusy(false);
    }
  }, [arrived, correcting, correction, reread, stopCorrecting]);

  const record = useCallback(async () => {
    setBusy(true);
    try {
      const recorded = await window.aetherForge.recordEntry(text);
      if (recorded.ok) {
        arrived(await reread());
        setText('');
      } else {
        setProblem(recorded.failure.detail);
      }
    } finally {
      setBusy(false);
    }
  }, [arrived, reread, text]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateRows: `${tokens.layout.titleBar} 1fr`,
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
          padding: `0 ${tokens.space[24]}`,
          borderBottom: `1px solid ${slot('ink', 'hairline')}`,
          background: slot('ground', 'sunken'),
          fontFamily: 'var(--font-numeric)',
          fontSize: tokens.type.micro,
          letterSpacing: tokens.tracking.capsWide,
          textTransform: 'uppercase',
          color: slot('ink', 'muted'),
        }}
      >
        <span>Aether Forge</span>
        <span data-testid="version" style={TABULAR}>
          {version === null ? 'connecting' : `v${version}`}
        </span>
      </header>

      <div style={{ display: 'flex', minHeight: 0, alignItems: 'stretch' }}>
        <EntitiesRail
          entities={held}
          types={entityTypes}
          busy={busy}
          onCreate={(request) => void createAnEntity(request)}
          onSetField={(entityId, fieldId, value) => void setAField(entityId, fieldId, value)}
          onAdvance={(entityId, trackId, by) => void advanceATrack(entityId, trackId, by)}
        />

        <main
          style={{
            margin: '0 auto',
            width: '100%',
            maxWidth: '60ch',
            padding: `34px ${tokens.layout.pageSide} 46px`,
            display: 'flex',
            flexDirection: 'column',
            gap: tokens.layout.pageSide,
            overflowY: 'auto',
          }}
        >
          <section data-testid="journal" style={{ display: 'grid', gap: tokens.space[24] }}>
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
            style={{ display: 'grid', gap: tokens.space[8] }}
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

          {/*
          The licenses require the credit, so the application renders it,
          quietly, where the content actually is. Not behind a menu: a
          condition on using someone's work is not a settings page.
        */}
          <footer data-testid="content-credits" style={{ display: 'grid', gap: tokens.space[4] }}>
            {credits.map((credit) => (
              <p key={credit.id} style={QUIET}>
                {credit.attribution ?? `${credit.title} ${credit.version}, ${credit.license}.`}
              </p>
            ))}
            <Button
              weight="quiet"
              data-testid="import-content"
              disabled={busy}
              onClick={() => void importContent()}
              style={{ justifySelf: 'start' }}
            >
              Import content…
            </Button>
          </footer>

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
    </div>
  );
}
