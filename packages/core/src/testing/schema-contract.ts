/**
 * Checks that every event type a build declares can still read its own history.
 *
 * Run against the real declarations, not against examples. The point is that
 * adding an event type, or changing one, cannot silently orphan campaigns
 * written by an earlier build: the check walks every version from 1 to current
 * and insists each one arrives at the same place.
 *
 * A type that has never changed passes trivially. That is fine. The value is
 * that the check is already there on the day it stops being trivial.
 */

import { describe, expect, it } from 'vitest';

import type { EventType } from '../event.js';
import type { EventSchemas } from '../schema.js';

export interface EventTypeSample {
  readonly type: EventType;
  /**
   * A payload exactly as it would have been written at each version, keyed by
   * that version. Must include every version from 1 to current.
   */
  readonly payloadsByVersion: Readonly<Record<number, unknown>>;
}

/**
 * @param name How these declarations should appear in test output.
 * @param schemas The declarations as the application actually builds them.
 * @param samples One per declared type.
 */
export function describeSchemaTranslations(
  name: string,
  schemas: () => EventSchemas,
  samples: readonly EventTypeSample[],
): void {
  describe(`${name} can still read every version it has ever written`, () => {
    it('has a sample for every declared type', () => {
      // Both directions, and the second one is the point. Checking only that
      // every sample is declared leaves the case this was written to prevent:
      // declaring a type and forgetting its sample, so that everything below
      // covers less than it appears to and nothing says so. That is exactly
      // what happened when core.roll.performed was declared.
      for (const sample of samples) {
        expect(schemas().knows(sample.type), `${sample.type} is not declared`).toBe(true);
      }

      const sampled = new Set(samples.map((sample) => sample.type));
      const unsampled = schemas()
        .declaredTypes()
        .filter((type) => !sampled.has(type));

      expect(unsampled, `declared with no sample payload: ${unsampled.join(', ')}`).toEqual([]);
      expect(samples.length).toBeGreaterThan(0);
    });

    for (const sample of samples) {
      describe(sample.type, () => {
        it('has a sample payload for every version from 1 to current', () => {
          const current = schemas().currentVersion(sample.type);
          if (!current.ok) throw new Error(`${sample.type} is not declared`);

          const expected = Array.from({ length: current.value }, (_, index) => index + 1);
          const provided = Object.keys(sample.payloadsByVersion).map(Number).sort();

          expect(provided).toEqual(expected);
        });

        it('brings every older version up to the current shape', () => {
          const registry = schemas();
          const current = registry.currentVersion(sample.type);
          if (!current.ok) throw new Error(`${sample.type} is not declared`);

          const target = sample.payloadsByVersion[current.value];

          for (let version = 1; version <= current.value; version += 1) {
            const steps = registry.translationsFrom(sample.type, version);
            if (!steps.ok) {
              throw new Error(
                `${sample.type} cannot be read from version ${version}: ${steps.failure.kind}`,
              );
            }

            const translated = steps.value.reduce<unknown>(
              (payload, step) => step.translate(payload),
              sample.payloadsByVersion[version],
            );

            expect(translated, `${sample.type} from version ${version}`).toEqual(target);
          }
        });
      });
    }
  });
}
