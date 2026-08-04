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
import {
  isVisibleToModule,
  type ModuleProjection,
  type ProjectionContext,
} from './module-projection.js';
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

/** Everything a campaign should work out as it reads its log. */
export interface CampaignViews {
  /** Views core owns and understands. */
  readonly projections?: readonly Projection<unknown>[];
  /** Views a system module owns. Core holds their state without reading it. */
  readonly moduleProjections?: readonly ModuleProjection<unknown>[];
}

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

  /** The current state of a core projection this campaign was opened with. */
  stateOf<State>(projection: Projection<State>): State;

  /**
   * The current state of a module's projection.
   *
   * Core has held this without ever looking inside it. Only the module that
   * owns it knows what it means.
   */
  moduleStateOf<State>(projection: ModuleProjection<State>): State;

  /** How many events this campaign has recorded. */
  count(): Result<number, LogFailure>;
}

export function openCampaign(
  log: TranslatingLog,
  views: CampaignViews = {},
): Result<OpenCampaign, CampaignFailure> {
  const projections = views.projections ?? [];
  const moduleProjections = views.moduleProjections ?? [];

  const events = log.read();
  if (!events.ok) return events;

  // Core state and module state are kept apart. Nothing in core reads inside
  // the module side; it is stored, handed back, and otherwise left alone.
  const coreState = new Map<string, unknown>();
  const moduleState = new Map<string, unknown>();

  const context: ProjectionContext = {
    stateOf<State>(projection: Projection<State>): State {
      return readBack(coreState, projection.id, 'core projection') as State;
    },
  };

  function readBack(from: Map<string, unknown>, id: string, what: string): unknown {
    if (!from.has(id)) {
      throw new Error(`this campaign was not opened with the ${what} "${id}"`);
    }
    return from.get(id);
  }

  function attempt(id: string, doing: string, produce: () => unknown): ProjectionFailed | null {
    try {
      produce();
      return null;
    } catch (cause) {
      return {
        kind: 'projection-failed',
        projectionId: id,
        detail: `${id} threw while ${doing}`,
        cause,
      };
    }
  }

  // Read once, then build everything from what was read. Reading per projection
  // would be several passes over the same file for the same answer.
  for (const projection of projections) {
    const wrong = attempt(projection.id, 'reading the campaign', () =>
      coreState.set(projection.id, replay(projection, events.value)),
    );
    if (wrong) return failed(wrong);
  }

  // Module views are built after core ones, so that a module reading a core
  // projection through the context sees it fully built rather than half way.
  for (const projection of moduleProjections) {
    const wrong = attempt(projection.id, 'reading the campaign', () => {
      let state = projection.initial();
      for (const event of events.value) {
        if (isVisibleToModule(event, projection.systemId)) {
          state = projection.apply(state, event, context);
        }
      }
      moduleState.set(projection.id, state);
    });
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
        const event = appended.value;

        for (const projection of projections) {
          const wrong = attempt(projection.id, `applying ${event.type}`, () =>
            coreState.set(projection.id, projection.apply(coreState.get(projection.id), event)),
          );
          if (wrong) return failed(wrong);
        }

        for (const projection of moduleProjections) {
          if (!isVisibleToModule(event, projection.systemId)) continue;

          const wrong = attempt(projection.id, `applying ${event.type}`, () =>
            moduleState.set(
              projection.id,
              projection.apply(moduleState.get(projection.id), event, context),
            ),
          );
          if (wrong) return failed(wrong);
        }

        return ok(event);
      },

      stateOf<State>(projection: Projection<State>): State {
        // The only assertions in this file, and both describe something the
        // type system cannot: state stored under an id was produced by the
        // projection with that id. There is no way to tie a string key to a
        // type parameter in TypeScript.
        return readBack(coreState, projection.id, 'core projection') as State;
      },

      moduleStateOf<State>(projection: ModuleProjection<State>): State {
        return readBack(moduleState, projection.id, 'module projection') as State;
      },

      count(): Result<number, LogFailure> {
        return log.count();
      },
    },
  };
}
