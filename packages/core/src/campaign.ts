/**
 * A campaign that is open: its log, and the state worked out from it.
 *
 * Opening reads the log once and builds every projection. After that, each
 * appended event updates them in place, so showing a value does not mean
 * re-reading ten thousand events.
 *
 * Appending goes through here rather than through the log directly. That is the
 * point: a log that can be written behind the projections' back is a log whose
 * projections quietly go stale, and nothing would say so.
 *
 * See `design/event-log-and-projections.md`.
 */

import type { EventEnvelope } from './event.js';
import type { CampaignId } from './identifiers.js';
import type { LogFailure } from './log.js';
import { replay, type Projection } from './projection.js';
import { failed, ok, type Result } from './result.js';
import type {
  TranslatingLog,
  TranslatingLogFailure,
  UnversionedEventDraft,
} from './translating-log.js';

/** A projection threw while being brought up to date. That is a bug in it. */
export interface ProjectionFailed {
  readonly kind: 'projection-failed';
  readonly projectionId: string;
  readonly detail: string;
  readonly cause?: unknown;
}

export type CampaignFailure = TranslatingLogFailure | ProjectionFailed;

export interface OpenCampaign {
  readonly campaignId: CampaignId;

  /**
   * Record something that happened, and bring the state up to date with it.
   *
   * If a projection throws, the event stays recorded, because it happened. The
   * failure names the projection so the bug can be found, and reopening the
   * campaign reports the same thing rather than hiding it.
   */
  append<Payload>(
    draft: UnversionedEventDraft<Payload>,
  ): Result<EventEnvelope<Payload>, CampaignFailure>;

  /** The current state of a projection this campaign was opened with. */
  stateOf<State>(projection: Projection<State>): State;

  /** How many events this campaign has recorded. */
  count(): Result<number, LogFailure>;
}

/**
 * Open a campaign and build its projections.
 *
 * @param projections Every view this campaign will be asked for. Asking for one
 *   it was not opened with is a mistake in the calling code rather than a state
 *   to handle, so it throws.
 */
export function openCampaign(
  log: TranslatingLog,
  projections: readonly Projection<unknown>[],
): Result<OpenCampaign, CampaignFailure> {
  const events = log.read();
  if (!events.ok) return events;

  const state = new Map<string, unknown>();

  function bringUpToDate(
    projection: Projection<unknown>,
    produce: () => unknown,
    doing: string,
  ): ProjectionFailed | null {
    try {
      state.set(projection.id, produce());
      return null;
    } catch (cause) {
      return {
        kind: 'projection-failed',
        projectionId: projection.id,
        detail: `${projection.id} threw while ${doing}`,
        cause,
      };
    }
  }

  // Read once, then build everything from what was read. Reading per projection
  // would be several passes over the same file for the same answer.
  for (const projection of projections) {
    const wrong = bringUpToDate(
      projection,
      () => replay(projection, events.value),
      'reading the campaign',
    );
    if (wrong) return failed(wrong);
  }

  return {
    ok: true,
    value: {
      campaignId: log.campaignId,

      append<Payload>(
        draft: UnversionedEventDraft<Payload>,
      ): Result<EventEnvelope<Payload>, CampaignFailure> {
        const appended = log.append(draft);
        if (!appended.ok) return appended;

        for (const projection of projections) {
          const wrong = bringUpToDate(
            projection,
            () => projection.apply(state.get(projection.id), appended.value),
            `applying ${appended.value.type}`,
          );
          if (wrong) return failed(wrong);
        }

        return ok(appended.value);
      },

      stateOf<State>(projection: Projection<State>): State {
        if (!state.has(projection.id)) {
          throw new Error(
            `this campaign was not opened with the projection "${projection.id}", ` +
              'so it has no state for it',
          );
        }

        // The only assertion in this file, and it is describing something the
        // type system cannot: the state stored under an id was produced by the
        // projection with that id, so it is that projection's State. There is
        // no way to tie a string key to a type parameter in TypeScript.
        return state.get(projection.id) as State;
      },

      count(): Result<number, LogFailure> {
        return log.count();
      },
    },
  };
}
