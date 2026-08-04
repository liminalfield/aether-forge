/**
 * Checks that a projection is predictable.
 *
 * The same log must always produce the same state. Nothing in the types can
 * enforce that, because a projection is ordinary code and ordinary code can
 * read the clock. So every projection is replayed twice and the two results
 * compared, and replayed once more in a fresh order-of-construction to catch
 * state accidentally shared between runs.
 *
 * This is the check the whole model rests on. If it fails, the campaign cannot
 * be trusted.
 */

import { describe, expect, it, vi } from 'vitest';

import type { EventEnvelope } from '../event.js';
import type { ModuleProjection, ProjectionContext } from '../module-projection.js';
import { replay, type Projection } from '../projection.js';

export function describeProjectionIsPredictable<State>(
  name: string,
  projection: () => Projection<State>,
  events: () => readonly EventEnvelope[],
): void {
  describe(`${name} is predictable`, () => {
    it('produces the same state from the same events, twice', () => {
      expect(replay(projection(), events())).toEqual(replay(projection(), events()));
    });

    it('produces the same state from a second, separately built projection', () => {
      // Catches state held outside the projection, for instance in a module
      // variable, which would survive between replays and drift.
      const once = replay(projection(), events());
      const again = replay(projection(), events());
      const third = replay(projection(), events());

      expect(once).toEqual(again);
      expect(again).toEqual(third);
    });

    it('leaves the events it was given untouched', () => {
      // A projection that mutates an event would corrupt every later replay,
      // and the corruption would only show up the second time round.
      // Compared as text because core has no platform, and so no
      // structuredClone.
      const given = events();
      const before = JSON.stringify(given);
      replay(projection(), given);

      expect(JSON.stringify(given)).toBe(before);
    });

    it('does not depend on what time it is', () => {
      // Replaying twice in a row will not catch a projection that reads the
      // clock, because both runs land in the same millisecond. Moving the clock
      // years between them does catch it, without waiting for anything.
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2020-01-01T00:00:00.000Z'));
        const longAgo = replay(projection(), events());

        vi.setSystemTime(new Date('2031-06-15T12:34:56.000Z'));
        const muchLater = replay(projection(), events());

        expect(muchLater).toEqual(longAgo);
      } finally {
        vi.useRealTimers();
      }
    });

    it('starts from the same place every time', () => {
      expect(projection().initial()).toEqual(projection().initial());
    });

    it('ignores events it does not care about', () => {
      const unrelated: EventEnvelope = {
        id: 'unrelated',
        campaignId: 'campaign-under-test',
        seq: 9_999,
        at: '2026-08-04T09:00:00.000Z',
        type: 'core.nothing.happened',
        schemaVersion: 1,
        payload: {},
      };

      const withoutIt = replay(projection(), events());
      const withIt = replay(projection(), [...events(), unrelated]);

      expect(withIt).toEqual(withoutIt);
    });
  });
}

/**
 * Treat a module's view as an ordinary projection, so the checks above apply to
 * it too.
 *
 * @param context What the module is allowed to read. Most module projections
 *   ignore it, and a context that throws proves they do.
 */
export function asProjection<State>(
  moduleProjection: ModuleProjection<State>,
  context: ProjectionContext = {
    stateOf: () => {
      throw new Error('this projection was checked without any core state available to it');
    },
  },
): Projection<State> {
  return {
    id: moduleProjection.id,
    initial: () => moduleProjection.initial(),
    apply: (state, event) => moduleProjection.apply(state, event, context),
  };
}
