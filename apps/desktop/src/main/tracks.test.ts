import {
  createMemoryEventLog,
  createTranslatingLog,
  entities as entitiesProjection,
  journal,
  openCampaign,
  suggestions,
  type EventLog,
  type OpenCampaign,
  type Projection,
} from '@aether-forge/core';
import { describe, expect, it } from 'vitest';

import { createEntity } from './entities';
import { declareEventTypes } from './event-types';
import { advanceTrack, setTrack, startTrack } from './tracks';

function aStoredLog(): EventLog {
  let tick = 0;
  return createMemoryEventLog({
    campaignId: 'campaign-under-test',
    now: () => `2026-08-08T10:00:00.${String(1000 + (tick += 1)).slice(1)}Z`,
    nextEventId: () => `event-${String(tick)}`,
  });
}

function openOver(stored: EventLog = aStoredLog()): OpenCampaign {
  const log = createTranslatingLog(stored, declareEventTypes());
  const opened = openCampaign(log, {
    projections: [
      journal as Projection<unknown>,
      suggestions as Projection<unknown>,
      entitiesProjection as Projection<unknown>,
    ],
  });
  if (!opened.ok) throw new Error('could not open the campaign');
  return opened.value;
}

/** An entity with one ten-segment track, and the campaign it lives in. */
function aVow(): { campaign: OpenCampaign; entityId: string } {
  const campaign = openOver();
  const made = createEntity(campaign, () => 'vow-1', { fields: { name: 'Carry the message' } });
  if (!made.ok) throw new Error(made.failure.detail);

  const started = startTrack(campaign, {
    entityId: 'vow-1',
    trackId: 'progress',
    segments: 10,
    filled: 0,
  });
  if (!started.ok) throw new Error(started.failure.detail);

  return { campaign, entityId: 'vow-1' };
}

describe('starting a track', () => {
  it('answers with the entity carrying its new track', () => {
    const { campaign, entityId } = aVow();
    const view = startTrack(campaign, { entityId, trackId: 'doubt', segments: 4, filled: 0 });

    expect(view.ok && view.value.tracks.map((track) => track.id)).toEqual(['progress', 'doubt']);
  });

  it('refuses an entity this campaign has never seen', () => {
    const started = startTrack(openOver(), {
      entityId: 'nobody',
      trackId: 'progress',
      segments: 10,
      filled: 0,
    });

    expect(!started.ok && started.failure.kind).toBe('unknown-entity');
  });

  it('refuses a second start of a track the entity already carries', () => {
    const { campaign, entityId } = aVow();
    const again = startTrack(campaign, { entityId, trackId: 'progress', segments: 4, filled: 0 });

    expect(!again.ok && again.failure.kind).toBe('duplicate-track');
  });

  it('refuses a track with no segments, which is shape, not legality', () => {
    const { campaign, entityId } = aVow();
    const started = startTrack(campaign, { entityId, trackId: 'x', segments: 0, filled: 0 });

    expect(!started.ok && started.failure.kind).toBe('invalid-request');
  });
});

describe('advancing a track', () => {
  it('moves by the amount, in either direction', () => {
    const { campaign, entityId } = aVow();
    advanceTrack(campaign, { entityId, trackId: 'progress', by: 2 });
    const view = advanceTrack(campaign, { entityId, trackId: 'progress', by: -1 });

    expect(view.ok && view.value.tracks[0]?.filled).toBe(1);
  });

  it('goes past full without comment, because judging is not recording', () => {
    const { campaign, entityId } = aVow();
    const view = advanceTrack(campaign, { entityId, trackId: 'progress', by: 25 });

    expect(view.ok && view.value.tracks[0]?.filled).toBe(25);
  });

  it('refuses a track nobody started, before anything is written', () => {
    const { campaign, entityId } = aVow();
    const moved = advanceTrack(campaign, { entityId, trackId: 'health', by: 1 });

    expect(!moved.ok && moved.failure.kind).toBe('unknown-track');
  });
});

describe('setting a track', () => {
  it('states where the track now stands', () => {
    const { campaign, entityId } = aVow();
    advanceTrack(campaign, { entityId, trackId: 'progress', by: 6 });
    const view = setTrack(campaign, { entityId, trackId: 'progress', filled: 3 });

    expect(view.ok && view.value.tracks[0]?.filled).toBe(3);
  });

  it('refuses a fractional fill as shape', () => {
    const { campaign, entityId } = aVow();
    const view = setTrack(campaign, { entityId, trackId: 'progress', filled: 2.5 });

    expect(!view.ok && view.failure.kind).toBe('invalid-request');
  });
});
