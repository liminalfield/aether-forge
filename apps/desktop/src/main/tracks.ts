import {
  describeFailure,
  entities,
  readTrackAdvanced,
  readTrackSet,
  readTrackStarted,
  TRACK_ADVANCED,
  TRACK_SET,
  TRACK_STARTED,
  type EntityRecord,
  type OpenCampaign,
  type TrackAdvancedV1,
  type TrackSetV1,
  type TrackStartedV1,
} from '@aether-forge/core';

import type { EntityView, IpcFailure, IpcResult } from '../shared/ipc';
import { entityView } from './entities';

/**
 * Tracks over the IPC contract.
 *
 * Each channel answers with the whole entity as it now stands, because a
 * track is part of its entity and the window redraws the entity, not a lone
 * number. Anything the projection would refuse to apply is refused here
 * instead, where it can be said, because appending an event the projection
 * ignores writes junk into a permanent log.
 *
 * There is no legality anywhere in this. A track advanced past full or below
 * empty is recorded and reported; the only refusals are shape and aim.
 */

function asIpcFailure(kind: string, detail: string): IpcResult<never> {
  const failure: IpcFailure = { kind, detail };
  return { ok: false, failure };
}

function findEntity(campaign: OpenCampaign, entityId: string): EntityRecord | undefined {
  return campaign.stateOf(entities).entities.find((each) => each.id === entityId);
}

function answerWith(campaign: OpenCampaign, entityId: string): IpcResult<EntityView> {
  const record = findEntity(campaign, entityId);
  if (record === undefined) {
    return asIpcFailure('projection-failed', 'the event was recorded but the campaign lost it');
  }
  return { ok: true, value: entityView(record) };
}

export function startTrack(campaign: OpenCampaign, request: unknown): IpcResult<EntityView> {
  const payload = readTrackStarted(request);
  if (payload === undefined) {
    return asIpcFailure(
      'invalid-request',
      'starting a track names its entity and track, a real number of segments, and how full it begins',
    );
  }

  const entity = findEntity(campaign, payload.entityId);
  if (entity === undefined) {
    return asIpcFailure('unknown-entity', 'this campaign has no such entity');
  }
  if (entity.tracks.some((track) => track.id === payload.trackId)) {
    return asIpcFailure('duplicate-track', 'this entity already carries that track');
  }

  const appended = campaign.append<TrackStartedV1>({ type: TRACK_STARTED, payload });
  if (!appended.ok) {
    return asIpcFailure(appended.failure.kind, describeFailure(appended.failure));
  }

  return answerWith(campaign, payload.entityId);
}

export function advanceTrack(campaign: OpenCampaign, request: unknown): IpcResult<EntityView> {
  const payload = readTrackAdvanced(request);
  if (payload === undefined) {
    return asIpcFailure(
      'invalid-request',
      'advancing a track names its entity and track and a whole number to move by',
    );
  }

  if (!aims(campaign, payload.entityId, payload.trackId)) {
    return asIpcFailure('unknown-track', 'this campaign has no such track to advance');
  }

  const appended = campaign.append<TrackAdvancedV1>({ type: TRACK_ADVANCED, payload });
  if (!appended.ok) {
    return asIpcFailure(appended.failure.kind, describeFailure(appended.failure));
  }

  return answerWith(campaign, payload.entityId);
}

export function setTrack(campaign: OpenCampaign, request: unknown): IpcResult<EntityView> {
  const payload = readTrackSet(request);
  if (payload === undefined) {
    return asIpcFailure(
      'invalid-request',
      'setting a track names its entity and track and the whole number it now stands at',
    );
  }

  if (!aims(campaign, payload.entityId, payload.trackId)) {
    return asIpcFailure('unknown-track', 'this campaign has no such track to set');
  }

  const appended = campaign.append<TrackSetV1>({ type: TRACK_SET, payload });
  if (!appended.ok) {
    return asIpcFailure(appended.failure.kind, describeFailure(appended.failure));
  }

  return answerWith(campaign, payload.entityId);
}

function aims(campaign: OpenCampaign, entityId: string, trackId: string): boolean {
  return findEntity(campaign, entityId)?.tracks.some((track) => track.id === trackId) ?? false;
}
