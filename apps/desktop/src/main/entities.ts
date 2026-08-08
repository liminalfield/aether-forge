import {
  describeFailure,
  entities,
  ENTITY_CHANGED,
  ENTITY_CREATED,
  nameOf,
  readEntityChanged,
  readEntityCreated,
  TRACK_STARTED,
  type EntityChangedV1,
  type EntityCreatedV1,
  type EntityRecord,
  type EntityTemplate,
  type OpenCampaign,
  type TrackStartedV1,
} from '@aether-forge/core';

import type {
  ChangeEntityRequest,
  CreateEntityRequest,
  EntitiesView,
  EntityTypesView,
  EntityView,
  IpcFailure,
  IpcResult,
  TrackView,
} from '../shared/ipc';
import { loadedSystems } from './systems';

/**
 * Entities over the IPC contract.
 *
 * Creation is where templates do their describing: a request naming a type
 * starts with that template's initial fields, under whatever the request
 * itself supplies, and the template's tracks are started alongside, each
 * caused by the creation. A request naming no type, or a type no loaded
 * module describes, creates exactly what it says, because a free-form entity
 * is first-class and a template nobody has is not an error.
 *
 * Everything is validated by the same readers the projection trusts, because
 * the window is another process and "the caller is our own code" is an
 * assumption rather than a fact.
 */

function asIpcFailure(kind: string, detail: string): IpcResult<never> {
  const failure: IpcFailure = { kind, detail };
  return { ok: false, failure };
}

function templateFor(entityType: string | undefined): EntityTemplate | undefined {
  if (entityType === undefined) return undefined;
  return loadedSystems()
    .flatMap((system) => system.templates)
    .find((template) => template.typeId === entityType);
}

function toTrackView(record: EntityRecord, template: EntityTemplate | undefined): TrackView[] {
  return record.tracks.map((track) => {
    const label = template?.tracks.find((spec) => spec.id === track.id)?.label;
    const view: TrackView = { id: track.id, segments: track.segments, filled: track.filled };
    return label === undefined ? view : { ...view, label };
  });
}

export function entityView(record: EntityRecord): EntityView {
  const template = templateFor(record.entityType);
  const name = nameOf(record);

  let view: EntityView = {
    id: record.id,
    fields: record.fields,
    tracks: toTrackView(record, template),
  };
  if (record.entityType !== undefined) view = { ...view, entityType: record.entityType };
  if (template !== undefined) view = { ...view, typeName: template.name };
  if (name !== undefined) view = { ...view, name };
  return view;
}

/** The entity types the loaded modules describe, in load order. */
export function describeEntityTypes(): EntityTypesView {
  return {
    types: loadedSystems().flatMap((system) =>
      system.templates.map((template) => ({ id: template.typeId, name: template.name })),
    ),
  };
}

/** Every entity in the campaign, in the order they came to exist. */
export function readEntities(campaign: OpenCampaign): IpcResult<EntitiesView> {
  return { ok: true, value: { entities: campaign.stateOf(entities).entities.map(entityView) } };
}

export function createEntity(
  campaign: OpenCampaign,
  nextEntityId: () => string,
  request: unknown,
): IpcResult<EntityView> {
  const asked = request as Partial<CreateEntityRequest> | null | undefined;
  if (typeof asked !== 'object' || asked === null) {
    return asIpcFailure('invalid-request', 'creating an entity needs a request');
  }

  const template = templateFor(typeof asked.entityType === 'string' ? asked.entityType : undefined);

  // The template's opinion first, the request's words over it. A request may
  // disagree with its template, and both are recorded as they are.
  const initials = Object.fromEntries(
    (template?.fields ?? [])
      .filter((field) => field.initial !== undefined)
      .map((field) => [field.id, field.initial]),
  );

  const candidate = {
    entityId: nextEntityId(),
    ...(asked.entityType === undefined ? {} : { entityType: asked.entityType }),
    fields: { ...initials, ...(asked.fields ?? {}) },
  };

  const payload: EntityCreatedV1 | undefined = readEntityCreated(candidate);
  if (payload === undefined) {
    return asIpcFailure(
      'invalid-request',
      'an entity is an id, an optional type, and fields holding plain values',
    );
  }

  const appended = campaign.append<EntityCreatedV1>({ type: ENTITY_CREATED, payload });
  if (!appended.ok) {
    return asIpcFailure(appended.failure.kind, describeFailure(appended.failure));
  }

  // The template's tracks, each caused by the creation, so the chain reads
  // "this exists, and because it exists, these rows of segments do".
  for (const spec of template?.tracks ?? []) {
    const started = campaign.append<TrackStartedV1>({
      type: TRACK_STARTED,
      causationId: appended.value.id,
      payload: {
        entityId: payload.entityId,
        trackId: spec.id,
        segments: spec.segments,
        filled: spec.startsFilled,
      },
    });
    if (!started.ok) {
      return asIpcFailure(started.failure.kind, describeFailure(started.failure));
    }
  }

  const record = campaign.stateOf(entities).entities.find((each) => each.id === payload.entityId);
  if (record === undefined) {
    return asIpcFailure(
      'projection-failed',
      'the entity was recorded but the campaign did not show it',
    );
  }

  return { ok: true, value: entityView(record) };
}

export function changeEntity(campaign: OpenCampaign, request: unknown): IpcResult<EntityView> {
  const asked = request as Partial<ChangeEntityRequest> | null | undefined;
  if (typeof asked !== 'object' || asked === null) {
    return asIpcFailure('invalid-request', 'changing an entity needs a request');
  }

  const payload = readEntityChanged({ entityId: asked.entityId, fields: asked.fields });
  if (payload === undefined) {
    return asIpcFailure(
      'invalid-request',
      'a change names its entity and the fields it sets, each holding a plain value',
    );
  }

  const known = campaign.stateOf(entities).entities.some((each) => each.id === payload.entityId);
  if (!known) {
    // Appending a change the projection would refuse to apply writes junk
    // into a permanent log. The refusal happens here, where it can be said.
    return asIpcFailure('unknown-entity', 'this campaign has no such entity');
  }

  const appended = campaign.append<EntityChangedV1>({ type: ENTITY_CHANGED, payload });
  if (!appended.ok) {
    return asIpcFailure(appended.failure.kind, describeFailure(appended.failure));
  }

  const record = campaign.stateOf(entities).entities.find((each) => each.id === payload.entityId);
  if (record === undefined) {
    return asIpcFailure(
      'projection-failed',
      'the change was recorded but the campaign did not show it',
    );
  }

  return { ok: true, value: entityView(record) };
}
