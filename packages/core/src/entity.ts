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

import type { EntityId } from './identifiers.js';
import type { EventTypeDefinition } from './schema.js';

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
