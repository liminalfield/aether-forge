/**
 * Entities: the named and not-yet-named things a campaign is about.
 *
 * Core owns the `core.entity.*` family. Unlike `sys.*` payloads, which core
 * stores and refuses to read, an entity's fields are core's own data: the
 * journal, the rails, a mention search and the export all have to work over
 * entities of every type, including types from modules that are no longer
 * installed. The words inside the fields are the module's; the storage and the
 * reading back are core's. Core still judges nothing: it knows an entity has a
 * field called `iron` holding 2, and has no opinion about what iron is.
 *
 * A change names the fields it sets and carries each one's whole new value.
 * Not a delta, and not the whole entity. Nothing is lost, nothing is repeated,
 * and `revises` keeps meaning only "this event was written wrongly".
 *
 * See `design/entities-and-tracks.md`.
 */

import type { EventEnvelope } from './event.js';
import type { EntityId, EventId } from './identifiers.js';
import type { Projection } from './projection.js';
import type { EventTypeDefinition } from './schema.js';
import {
  readTrackAdvanced,
  readTrackSet,
  readTrackStarted,
  TRACK_ADVANCED,
  TRACK_SET,
  TRACK_STARTED,
} from './track.js';

export const ENTITY_CREATED = 'core.entity.created';
export const ENTITY_CHANGED = 'core.entity.changed';

/**
 * What one recorded fact about an entity may hold.
 *
 * Plain values, deliberately. A field holding structure would be a document
 * pretending to be a fact, and the things that want structure (prose, images)
 * have homes of their own (entries, the blob store when it exists).
 */
export type FieldValue = string | number | boolean;

export type EntityFields = Readonly<Record<string, FieldValue>>;

/**
 * Version 1 of an entity coming to exist.
 *
 * Everything after the id is optional, because an entity must be recordable
 * the moment it matters: "whoever paid the indenture" has no name, and a
 * free-form note of a thing has no type. The id lives in the payload rather
 * than borrowing the event's id, so the payload says what it is about without
 * the envelope, the same way a change does.
 */
export interface EntityCreatedV1 {
  readonly entityId: EntityId;
  /** A module's namespaced type, or absent for a free-form entity. */
  readonly entityType?: string;
  readonly fields: EntityFields;
}

/** Version 1 of some of an entity's facts changing. */
export interface EntityChangedV1 {
  readonly entityId: EntityId;
  /** Only the fields being set, each carrying its whole new value. */
  readonly fields: EntityFields;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFieldValue(value: unknown): value is FieldValue {
  return (
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    typeof value === 'boolean'
  );
}

/** The fields of a payload, or undefined when any of them is not a plain value. */
function readFields(value: unknown): EntityFields | undefined {
  if (!isRecord(value)) return undefined;

  for (const each of Object.values(value)) {
    if (!isFieldValue(each)) return undefined;
  }

  return value as EntityFields;
}

export function readEntityCreated(payload: unknown): EntityCreatedV1 | undefined {
  if (!isRecord(payload)) return undefined;

  const entityId = payload['entityId'];
  if (typeof entityId !== 'string' || entityId === '') return undefined;

  const fields = readFields(payload['fields']);
  if (fields === undefined) return undefined;

  const entityType = payload['entityType'];
  if (entityType === undefined) return { entityId, fields };
  if (typeof entityType !== 'string' || entityType === '') return undefined;

  return { entityId, entityType, fields };
}

export function readEntityChanged(payload: unknown): EntityChangedV1 | undefined {
  if (!isRecord(payload)) return undefined;

  const entityId = payload['entityId'];
  if (typeof entityId !== 'string' || entityId === '') return undefined;

  const fields = readFields(payload['fields']);
  if (fields === undefined) return undefined;

  return { entityId, fields };
}

export const entityEventTypes: readonly EventTypeDefinition[] = [
  { type: ENTITY_CREATED, currentVersion: 1, translations: [], corrections: 'replaces-a-value' },
  { type: ENTITY_CHANGED, currentVersion: 1, translations: [], corrections: 'replaces-a-value' },
];

/** One track as of now: its shape, and how full the log says it is. */
export interface TrackState {
  readonly id: string;
  readonly segments: number;
  /** May stand past full or below empty. Reported, never judged. */
  readonly filled: number;
  /** The event that started it. */
  readonly startedBy: EventId;
}

/** One entity as of now: what the log says about it so far. */
export interface EntityRecord {
  readonly id: EntityId;
  /** Absent for a free-form entity. */
  readonly entityType?: string;
  readonly fields: EntityFields;
  /** In the order they were started. */
  readonly tracks: readonly TrackState[];
  /** The event that created it. */
  readonly createdBy: EventId;
  /** The most recent event that touched it, tracks included. */
  readonly touchedBy: EventId;
}

/** What one applied track event did, kept so a revision can undo its share. */
export interface TrackContribution {
  readonly entityId: EntityId;
  readonly trackId: string;
  readonly kind: 'started' | 'advanced' | 'set';
  /** The started fill, the advanced amount, or the stated fill. */
  readonly amount: number;
}

export interface Entities {
  /** In the order they came to exist. */
  readonly entities: readonly EntityRecord[];
  /**
   * Which entity each applied event touched, so a revision of an old event
   * finds its entity the way a correction of a correction finds its entry.
   *
   * A plain object rather than a Map, so the state stays something that can
   * be written out unchanged when snapshots arrive.
   */
  readonly entityOf: Readonly<Record<EventId, EntityId>>;
  /**
   * What each applied track event contributed. A revision needs the original
   * amount to replace, and an entry is removed once revised, so revising the
   * same event twice is refused rather than applied twice; the correction of
   * a correction revises the correction, as everywhere else.
   */
  readonly trackEventOf: Readonly<Record<EventId, TrackContribution>>;
}

/**
 * An entity's name, when it has one worth the word.
 *
 * The `name` field when it is a non-empty string, and nothing otherwise. What
 * to show for a nameless entity is the window's decision; this only refuses
 * to pretend an empty string is a name.
 */
export function nameOf(entity: EntityRecord): string | undefined {
  const name = entity.fields['name'];
  return typeof name === 'string' && name !== '' ? name : undefined;
}

function touch(
  state: Entities,
  entityId: EntityId,
  eventId: EventId,
  change: (entity: EntityRecord) => EntityRecord,
): Entities {
  return {
    ...state,
    entities: state.entities.map((entity) =>
      entity.id === entityId ? { ...change(entity), touchedBy: eventId } : entity,
    ),
    entityOf: { ...state.entityOf, [eventId]: entityId },
  };
}

/**
 * Every entity in the campaign, with its fields as of now.
 *
 * Events apply strictly in log order, and a revision's fields win at the
 * revision's own position, like any other event. Revising an old change after
 * a newer change touched the same field therefore moves the field to the
 * revision's value, which is the same discipline the journal keeps: a
 * correction is expected to correct the current state of things, and the
 * window hands it the current version to supersede.
 *
 * An event that references an entity this campaign has never seen, or whose
 * payload names a different entity than the event it revises touched, is not
 * something to guess about, and leaves the state alone.
 */
export const entities: Projection<Entities> = {
  id: 'core.entities',

  initial: () => ({ entities: [], entityOf: {}, trackEventOf: {} }),

  apply: (state, event: EventEnvelope): Entities => {
    if (event.type === ENTITY_CREATED) {
      const created = readEntityCreated(event.payload);
      if (created === undefined) return state;

      const revises = event.revises;
      if (revises !== undefined) {
        const entityId = state.entityOf[revises];
        if (entityId === undefined || entityId !== created.entityId) return state;

        // The creation was written wrongly. The revised payload's type stands
        // whole, absent meaning free-form; its fields win at this position.
        return touch(state, entityId, event.id, (entity) => {
          const retyped: EntityRecord = {
            id: entity.id,
            fields: { ...entity.fields, ...created.fields },
            tracks: entity.tracks,
            createdBy: entity.createdBy,
            touchedBy: entity.touchedBy,
          };
          return created.entityType === undefined
            ? retyped
            : { ...retyped, entityType: created.entityType };
        });
      }

      // A second creation of an entity this campaign already has is a
      // recording mistake nothing here can repair. Refuse to guess.
      if (state.entities.some((entity) => entity.id === created.entityId)) return state;

      const record: EntityRecord = {
        id: created.entityId,
        fields: created.fields,
        tracks: [],
        createdBy: event.id,
        touchedBy: event.id,
      };

      return {
        ...state,
        entities: [
          ...state.entities,
          created.entityType === undefined ? record : { ...record, entityType: created.entityType },
        ],
        entityOf: { ...state.entityOf, [event.id]: created.entityId },
      };
    }

    if (event.type === ENTITY_CHANGED) {
      const changed = readEntityChanged(event.payload);
      if (changed === undefined) return state;

      const revises = event.revises;
      if (revises !== undefined) {
        const entityId = state.entityOf[revises];
        if (entityId === undefined || entityId !== changed.entityId) return state;
      } else if (!state.entities.some((entity) => entity.id === changed.entityId)) {
        return state;
      }

      return touch(state, changed.entityId, event.id, (entity) => ({
        ...entity,
        fields: { ...entity.fields, ...changed.fields },
      }));
    }

    if (event.type === TRACK_STARTED) {
      const started = readTrackStarted(event.payload);
      if (started === undefined) return state;

      const revises = event.revises;
      if (revises !== undefined) {
        const original = state.trackEventOf[revises];
        if (original === undefined || original.kind !== 'started') return state;
        if (original.entityId !== started.entityId || original.trackId !== started.trackId) {
          return state;
        }

        // The start was written wrongly. The shape is absolute and stands
        // whole; the starting fill is a contribution, so the fill moves by
        // the difference, keeping every advance made since.
        return contribute(
          state,
          event.id,
          revises,
          {
            entityId: started.entityId,
            trackId: started.trackId,
            kind: 'started',
            amount: started.filled,
          },
          (track) => ({
            ...track,
            segments: started.segments,
            filled: track.filled + started.filled - original.amount,
          }),
        );
      }

      const entity = state.entities.find((each) => each.id === started.entityId);
      if (entity === undefined) return state;

      // A second start of a track the entity already carries is a recording
      // mistake nothing here can repair. Refuse to guess.
      if (entity.tracks.some((track) => track.id === started.trackId)) return state;

      const withTrack = touch(state, started.entityId, event.id, (each) => ({
        ...each,
        tracks: [
          ...each.tracks,
          {
            id: started.trackId,
            segments: started.segments,
            filled: started.filled,
            startedBy: event.id,
          },
        ],
      }));

      return {
        ...withTrack,
        trackEventOf: {
          ...withTrack.trackEventOf,
          [event.id]: {
            entityId: started.entityId,
            trackId: started.trackId,
            kind: 'started',
            amount: started.filled,
          },
        },
      };
    }

    if (event.type === TRACK_ADVANCED) {
      const advanced = readTrackAdvanced(event.payload);
      if (advanced === undefined) return state;

      const revises = event.revises;
      if (revises !== undefined) {
        const original = state.trackEventOf[revises];
        if (original === undefined || original.kind !== 'advanced') return state;
        if (original.entityId !== advanced.entityId || original.trackId !== advanced.trackId) {
          return state;
        }

        // An advance is relative, so its correction is too: the fill moves by
        // the difference between what was meant and what was written.
        return contribute(
          state,
          event.id,
          revises,
          {
            entityId: advanced.entityId,
            trackId: advanced.trackId,
            kind: 'advanced',
            amount: advanced.by,
          },
          (track) => ({ ...track, filled: track.filled + advanced.by - original.amount }),
        );
      }

      if (!hasTrack(state, advanced.entityId, advanced.trackId)) return state;

      return contribute(
        state,
        event.id,
        undefined,
        {
          entityId: advanced.entityId,
          trackId: advanced.trackId,
          kind: 'advanced',
          amount: advanced.by,
        },
        (track) => ({ ...track, filled: track.filled + advanced.by }),
      );
    }

    if (event.type === TRACK_SET) {
      const set = readTrackSet(event.payload);
      if (set === undefined) return state;

      const revises = event.revises;
      if (revises !== undefined) {
        const original = state.trackEventOf[revises];
        if (original === undefined || original.kind !== 'set') return state;
        if (original.entityId !== set.entityId || original.trackId !== set.trackId) return state;

        // A set is absolute, so its correction states the fill outright.
        return contribute(
          state,
          event.id,
          revises,
          {
            entityId: set.entityId,
            trackId: set.trackId,
            kind: 'set',
            amount: set.filled,
          },
          (track) => ({ ...track, filled: set.filled }),
        );
      }

      if (!hasTrack(state, set.entityId, set.trackId)) return state;

      return contribute(
        state,
        event.id,
        undefined,
        {
          entityId: set.entityId,
          trackId: set.trackId,
          kind: 'set',
          amount: set.filled,
        },
        (track) => ({ ...track, filled: set.filled }),
      );
    }

    return state;
  },
};

function hasTrack(state: Entities, entityId: EntityId, trackId: string): boolean {
  return (
    state.entities
      .find((entity) => entity.id === entityId)
      ?.tracks.some((track) => track.id === trackId) ?? false
  );
}

/**
 * Applies one track event: records what it contributed, retires the entry of
 * the event it revises (if any), and moves the named track.
 */
function contribute(
  state: Entities,
  eventId: EventId,
  revises: EventId | undefined,
  contribution: TrackContribution,
  change: (track: TrackState) => TrackState,
): Entities {
  const touched = touch(state, contribution.entityId, eventId, (entity) => ({
    ...entity,
    tracks: entity.tracks.map((track) =>
      track.id === contribution.trackId ? change(track) : track,
    ),
  }));

  const trackEventOf: Record<EventId, TrackContribution> = {
    ...touched.trackEventOf,
    [eventId]: contribution,
  };
  if (revises !== undefined) delete trackEventOf[revises];

  return { ...touched, trackEventOf };
}
