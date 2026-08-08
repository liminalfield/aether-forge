import { useState } from 'react';

import { Button, labelStyle, Meter, slot, TABULAR_NUMERALS, tokens } from '@aether-forge/ui';

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

const FIELD = {
  background: slot('ground', 'raised'),
  color: slot('ink', 'primary'),
  border: `1px solid ${slot('ink', 'hairline')}`,
  borderRadius: tokens.radius.sm,
  padding: `${tokens.space[4]} ${tokens.radius.md}`,
  fontFamily: 'var(--font-numeric)',
  fontSize: tokens.type.small,
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

/**
 * The entities, in groups, in the order the modules describe their types.
 *
 * That order is the module's own opinion about what matters: Ironsworn
 * declares a character before a vow, so a character sits above the vows. The
 * window does not know what a character is and does not need to; it puts the
 * groups in the order it was given them.
 *
 * Free-form entities and unnamed ones come last, because they are notes
 * rather than the things you are playing.
 */
function groupsOf(
  entities: readonly EntityView[],
  types: readonly EntityTypeView[],
): readonly { readonly title: string; readonly members: readonly EntityView[] }[] {
  const named = entities.filter((entity) => entity.name !== undefined);
  const unnamed = entities.filter((entity) => entity.name === undefined);

  const described = types.flatMap((type) => {
    const members = named.filter((entity) => entity.entityType === type.id);
    return members.length === 0 ? [] : [{ title: type.name, members }];
  });

  const loose = named.filter((entity) => !types.some((type) => type.id === entity.entityType));

  return [
    ...described,
    ...(loose.length === 0 ? [] : [{ title: 'Notes', members: loose }]),
    ...(unnamed.length === 0 ? [] : [{ title: 'Unnamed', members: unnamed }]),
  ];
}

/** What a person can read at a glance, without opening anything. */
function Summary({ entity }: { readonly entity: EntityView }): React.JSX.Element | null {
  const numbers = Object.entries(entity.fields).filter(([, value]) => typeof value === 'number');

  if (numbers.length === 0 && entity.tracks.length === 0) return null;

  return (
    <div style={{ display: 'grid', gap: tokens.space[2], padding: `0 0 0 ${tokens.space[8]}` }}>
      {numbers.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space[8] }}>
          {numbers.map(([field, value]) => (
            <span
              key={field}
              data-testid={`stat-${field}`}
              style={{ display: 'flex', gap: tokens.space[4], alignItems: 'baseline' }}
            >
              <span style={labelStyle('line')}>{field}</span>
              <span
                style={{
                  fontFamily: 'var(--font-numeric)',
                  fontSize: tokens.type.compact,
                  ...TABULAR_NUMERALS,
                }}
              >
                {String(value)}
              </span>
            </span>
          ))}
        </div>
      )}

      {entity.tracks.map((track) => (
        <div key={track.id} style={{ display: 'flex', gap: tokens.space[8], alignItems: 'center' }}>
          <span style={{ ...labelStyle('line'), minWidth: '7ch' }}>{track.label ?? track.id}</span>
          <Meter
            data-testid={`summary-${track.id}`}
            label={track.label ?? track.id}
            segments={track.segments}
            filled={track.filled}
            shape={track.draws === 'earned' ? 'boxes' : 'bar'}
          />
        </div>
      ))}
    </div>
  );
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
        gap: tokens.space[4],
        padding: `${tokens.space[4]} 0 ${tokens.space[8]} ${tokens.space[8]}`,
      }}
    >
      {Object.entries(entity.fields).map(([fieldId, value]) => (
        <label
          key={fieldId}
          style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: tokens.space[4] }}
        >
          <span style={labelStyle()}>{fieldId}</span>
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
            gap: tokens.space[4],
            justifyContent: 'space-between',
          }}
        >
          <span style={labelStyle()}>{track.label ?? track.id}</span>
          <Meter
            data-testid={`track-${track.id}`}
            label={track.label ?? track.id}
            segments={track.segments}
            filled={track.filled}
            shape={track.draws === 'earned' ? 'boxes' : 'bar'}
          />
          <span style={{ display: 'flex', gap: tokens.space[2] }}>
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
        width: tokens.layout.rail,
        padding: tokens.space[16],
        borderLeft: `${tokens.border.hair} solid ${slot('ink', 'hairline')}`,
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.space[16],
        overflowY: 'auto',
      }}
    >
      {groupsOf(entities, types).map((group) => (
        <section key={group.title} style={{ display: 'grid', gap: tokens.space[4] }}>
          <h2 style={{ fontWeight: 500 }}>{group.title}</h2>
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
                  fontSize: tokens.type.compact,
                  cursor: 'pointer',
                }}
              >
                {entity.name ?? `${entity.typeName ?? 'something'}, unnamed`}
              </button>
              <Summary entity={entity} />

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
        style={{ display: 'grid', gap: tokens.space[4], marginTop: 'auto' }}
        onSubmit={(event) => {
          event.preventDefault();
          note();
        }}
      >
        <label style={labelStyle()} htmlFor="new-entity-name">
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
