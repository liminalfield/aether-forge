import { Button, slot, tokens, WritingSurface } from '@aether-forge/ui';

import type { JournalEntryView } from '../shared/ipc';

/**
 * One thing somebody wrote, and the way to change what it says.
 *
 * Nothing is edited. Saving appends a correction that supersedes the entry's
 * current version, and both stay in the log forever.
 */
export interface EntryProps {
  readonly entry: JournalEntryView;
  /** Which entry is being changed, if any. */
  readonly correcting: string | null;
  readonly correction: string;
  readonly busy: boolean;
  readonly onStart: (entry: JournalEntryView) => void;
  readonly onStop: () => void;
  readonly onChange: (text: string) => void;
  readonly onSave: () => void;
}

export function Entry({
  entry,
  correcting,
  correction,
  busy,
  onStart,
  onStop,
  onChange,
  onSave,
}: EntryProps): React.JSX.Element {
  if (correcting === entry.id) {
    return (
      <article data-testid="entry">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
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
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onStop();
            }}
          />
          <div style={{ display: 'flex', gap: tokens.space.sm }}>
            <Button type="submit" disabled={busy}>
              Save
            </Button>
            <Button weight="quiet" onClick={onStop}>
              Cancel
            </Button>
          </div>
        </form>
      </article>
    );
  }

  return (
    <article data-testid="entry">
      {/*
        A button rather than a paragraph with a click handler, so it can be
        reached and used from the keyboard without inventing anything.
      */}
      <button
        type="button"
        data-testid="entry-text"
        title="Change what this says"
        onClick={() => onStart(entry)}
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
    </article>
  );
}
