import { useState } from 'react';

import { Button, slot, tokens } from '@aether-forge/ui';

import type { EntityTypeView, EntityView, FieldValueView } from '../shared/ipc';

/**
 * The campaign's entities, grouped and quiet, at the left of the writing.
 *
 * The design's left rail holds threads, entities and a pinned truth. Only
 * entities exist, so only entities are here; the rail grows as its contents
 * come to exist rather than opening with empty rooms.
 *
 * Names on screen come from what the log holds and what the loaded modules
 * call things. Nothing here knows any game: a group is a type name a module
 * supplied, and an entity nobody named yet sits under "Unnamed", which is a
 * real state and not a defect, because an open question matters before it has
 * a name.
 */

const LABEL = {
  fontFamily: 'var(--font-numeric)',
  fontSize: '10.5px',
  letterSpacing: '.16em',
  textTransform: 'uppercase',
  color: slot('ink', 'muted'),
} as const;

const FIELD = {
  background: slot('ground', 'raised'),
  color: slot('ink', 'primary'),
  border: `1px solid ${slot('ink', 'hairline')}`,
  borderRadius: tokens.radius.sm,
  padding: '4px 6px',
  fontFamily: 'var(--font-numeric)',
  fontSize: '12px',
} as const;

/** A typed-in value, read the way the field currently holds it. */
function asHeld(current: FieldValueView, typed: string): FieldValueView {
  if (typeof current === 'number' && typed.trim() !== '' && !Number.isNaN(Number(typed))) {
    return Number(typed);
  }
  if (typeof current === 'boolean') return typed === 'true';
  return typed;
}

export interface EntitiesRailProps {
  readonly entities: readonly EntityView[];
  readonly types: readonly EntityTypeView[];
  readonly busy: boolean;
  readonly onCreate: (request: { entityType?: string; name: string }) => void;
  readonly onSetField: (entityId: string, fieldId: string, value: FieldValueView) => void;
  readonly onAdvance: (entityId: string, trackId: string, by: number) => void;
}

function groupsOf(
  entities: readonly EntityView[],
): readonly { readonly title: string; readonly members: readonly EntityView[] }[] {
  const named = entities.filter((entity) => entity.name !== undefined);
  const unnamed = entities.filter((entity) => entity.name === undefined);

  const titles = [...new Set(named.map((entity) => entity.typeName ?? 'Notes'))];
  const groups = titles.map((title) => ({
    title,
    members: named.filter((entity) => (entity.typeName ?? 'Notes') === title),
  }));

  return unnamed.length === 0 ? groups : [...groups, { title: 'Unnamed', members: unnamed }];
}

function Expanded({
  entity,
  busy,
  onSetField,
  onAdvance,
}: {
  readonly entity: EntityView;
  readonly busy: boolean;
  readonly onSetField: EntitiesRailProps['onSetField'];
  readonly onAdvance: EntitiesRailProps['onAdvance'];
}): React.JSX.Element {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  return (
    <div
      style={{
        display: 'grid',
        gap: tokens.space.xs,
        padding: `${tokens.space.xs} 0 ${tokens.space.sm} ${tokens.space.sm}`,
      }}
    >
      {Object.entries(entity.fields).map(([fieldId, value]) => (
        <label
          key={fieldId}
          style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: tokens.space.xs }}
        >
          <span style={LABEL}>{fieldId}</span>
          <input
            data-testid={`field-${fieldId}`}
            value={drafts[fieldId] ?? String(value)}
            disabled={busy}
            onChange={(event) => setDrafts((held) => ({ ...held, [fieldId]: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              const typed = drafts[fieldId];
              if (typed === undefined || typed === String(value)) return;
              onSetField(entity.id, fieldId, asHeld(value, typed));
              setDrafts(({ [fieldId]: _done, ...rest }) => rest);
            }}
            style={{ ...FIELD, width: '9ch' }}
          />
        </label>
      ))}

      {entity.tracks.map((track) => (
        <div
          key={track.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: tokens.space.xs,
            justifyContent: 'space-between',
          }}
        >
          <span style={LABEL}>{track.label ?? track.id}</span>
          <span
            data-testid={`track-${track.id}`}
            style={{ fontFamily: 'var(--font-numeric)', fontSize: '12px' }}
          >
            {track.filled}/{track.segments}
          </span>
          <span style={{ display: 'flex', gap: '2px' }}>
            <Button
              weight="quiet"
              data-testid={`retreat-${track.id}`}
              disabled={busy}
              aria-label={`${track.label ?? track.id}, back one`}
              onClick={() => onAdvance(entity.id, track.id, -1)}
            >
              −
            </Button>
            <Button
              weight="quiet"
              data-testid={`advance-${track.id}`}
              disabled={busy}
              aria-label={`${track.label ?? track.id}, forward one`}
              onClick={() => onAdvance(entity.id, track.id, 1)}
            >
              +
            </Button>
          </span>
        </div>
      ))}
    </div>
  );
}

export function EntitiesRail({
  entities,
  types,
  busy,
  onCreate,
  onSetField,
  onAdvance,
}: EntitiesRailProps): React.JSX.Element {
  const [open, setOpen] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [entityType, setEntityType] = useState('');

  const note = (): void => {
    const trimmed = name.trim();
    if (trimmed === '') return;
    onCreate(entityType === '' ? { name: trimmed } : { entityType, name: trimmed });
    setName('');
  };

  return (
    <aside
      data-testid="entities-rail"
      aria-label="Entities"
      style={{
        width: '210px',
        padding: tokens.space.md,
        borderRight: `1px solid ${slot('ink', 'hairline')}`,
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.space.md,
        overflowY: 'auto',
      }}
    >
      {groupsOf(entities).map((group) => (
        <section key={group.title} style={{ display: 'grid', gap: tokens.space.xs }}>
          <h2 style={{ ...LABEL, margin: 0, fontWeight: 500 }}>{group.title}</h2>
          {group.members.map((entity) => (
            <div key={entity.id}>
              <button
                type="button"
                data-testid="entity"
                onClick={() => setOpen(open === entity.id ? null : entity.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  textAlign: 'left',
                  width: '100%',
                  color: slot('ink', 'primary'),
                  fontFamily: 'var(--font-ui)',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                {entity.name ?? `${entity.typeName ?? 'something'}, unnamed`}
              </button>
              {open === entity.id && (
                <Expanded
                  entity={entity}
                  busy={busy}
                  onSetField={onSetField}
                  onAdvance={onAdvance}
                />
              )}
            </div>
          ))}
        </section>
      ))}

      <form
        style={{ display: 'grid', gap: tokens.space.xs, marginTop: 'auto' }}
        onSubmit={(event) => {
          event.preventDefault();
          note();
        }}
      >
        <label style={LABEL} htmlFor="new-entity-name">
          Note someone or something
        </label>
        {types.length > 0 && (
          <select
            aria-label="What kind"
            data-testid="new-entity-type"
            value={entityType}
            onChange={(event) => setEntityType(event.target.value)}
            style={FIELD}
          >
            <option value="">Just a note</option>
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        )}
        <input
          id="new-entity-name"
          data-testid="new-entity-name"
          value={name}
          placeholder="A name"
          onChange={(event) => setName(event.target.value)}
          style={FIELD}
        />
        <Button data-testid="note-it" disabled={busy || name.trim() === ''} type="submit">
          Note it
        </Button>
      </form>
    </aside>
  );
}
