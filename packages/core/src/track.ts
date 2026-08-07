/**
 * Tracks: segmented progress riding on an entity.
 *
 * A vow's progress, a clock's wedges, a condition meter. A track is started
 * once, fixing its shape, and then moved: `advanced` by an amount when
 * something happened, `set` outright when a rule or a person states where it
 * now stands. Moves are compensated, not corrected; un-marking progress is a
 * further advance with a negative amount, and the log keeps both, which is
 * what a record of a game is.
 *
 * There is no legality here. A track can be advanced past full and below
 * empty, and the projection reports what the log says; whether twelve of ten
 * means something is the owning module's business at presentation time. The
 * one refusal is shape: a track with no segments is not a track, the way a
 * d10 showing 12 is not a die.
 *
 * See `design/entities-and-tracks.md`.
 */

import type { EntityId } from './identifiers.js';
import type { EventTypeDefinition } from './schema.js';

export const TRACK_STARTED = 'core.track.started';
export const TRACK_ADVANCED = 'core.track.advanced';
export const TRACK_SET = 'core.track.set';

/** Version 1 of a track coming to exist on an entity. */
export interface TrackStartedV1 {
  readonly entityId: EntityId;
  /** Names the track among the entity's tracks: "progress", "health". */
  readonly trackId: string;
  /** How many segments the row has. At least one. */
  readonly segments: number;
  /** How full it begins. A condition meter starts full, a vow empty. */
  readonly filled: number;
}

/** Version 1 of a track moving by an amount, which may be negative. */
export interface TrackAdvancedV1 {
  readonly entityId: EntityId;
  readonly trackId: string;
  readonly by: number;
}

/** Version 1 of a track being stated outright: it now stands at this. */
export interface TrackSetV1 {
  readonly entityId: EntityId;
  readonly trackId: string;
  readonly filled: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The two names every track event carries, or undefined when malformed. */
function readNames(
  payload: Record<string, unknown>,
): { entityId: EntityId; trackId: string } | undefined {
  const entityId = payload['entityId'];
  if (typeof entityId !== 'string' || entityId === '') return undefined;

  const trackId = payload['trackId'];
  if (typeof trackId !== 'string' || trackId === '') return undefined;

  return { entityId, trackId };
}

export function readTrackStarted(payload: unknown): TrackStartedV1 | undefined {
  if (!isRecord(payload)) return undefined;

  const names = readNames(payload);
  if (names === undefined) return undefined;

  const segments = payload['segments'];
  if (typeof segments !== 'number' || !Number.isInteger(segments) || segments < 1) {
    return undefined;
  }

  const filled = payload['filled'];
  if (typeof filled !== 'number' || !Number.isInteger(filled)) return undefined;

  return { ...names, segments, filled };
}

export function readTrackAdvanced(payload: unknown): TrackAdvancedV1 | undefined {
  if (!isRecord(payload)) return undefined;

  const names = readNames(payload);
  if (names === undefined) return undefined;

  const by = payload['by'];
  if (typeof by !== 'number' || !Number.isInteger(by)) return undefined;

  return { ...names, by };
}

export function readTrackSet(payload: unknown): TrackSetV1 | undefined {
  if (!isRecord(payload)) return undefined;

  const names = readNames(payload);
  if (names === undefined) return undefined;

  const filled = payload['filled'];
  if (typeof filled !== 'number' || !Number.isInteger(filled)) return undefined;

  return { ...names, filled };
}

export const trackEventTypes: readonly EventTypeDefinition[] = [
  { type: TRACK_STARTED, currentVersion: 1, translations: [], corrections: 'replaces-a-value' },
  { type: TRACK_ADVANCED, currentVersion: 1, translations: [], corrections: 'replaces-a-value' },
  { type: TRACK_SET, currentVersion: 1, translations: [], corrections: 'replaces-a-value' },
];
