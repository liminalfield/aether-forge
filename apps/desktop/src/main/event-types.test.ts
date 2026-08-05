import { describeSchemaTranslations } from '@aether-forge/core/testing';

import { ENTRY_CREATED, ENTRY_REVISED, ROLL_PERFORMED } from '@aether-forge/core';
import { eventTypes as ironswornEventTypes } from '@aether-forge/system-ironsworn';
import { eventTypes as toyEventTypes } from '@aether-forge/system-toy';

import { declareEventTypes } from './event-types';

/**
 * Walks every declared event type from version 1 to whatever it is on now.
 *
 * Trivial today, because nothing has changed shape yet. It is here now so that
 * it is already in place on the day something does, which is the day it stops
 * being possible to add it honestly.
 *
 * A sample is required for every type this build declares, including the ones
 * the modules bring, so declaring a type without one fails here rather than
 * quietly narrowing what the rest of this file checks.
 */
const moduleSamples = [...toyEventTypes, ...ironswornEventTypes].map((definition) => ({
  type: definition.type,
  payloadsByVersion: { 1: {} },
}));

describeSchemaTranslations('this build', declareEventTypes, [
  {
    type: ENTRY_CREATED,
    payloadsByVersion: {
      1: { text: 'The airlock did not open.' },
    },
  },
  {
    type: ENTRY_REVISED,
    payloadsByVersion: {
      1: { text: 'The airlock opened on the second try.' },
    },
  },
  {
    type: ROLL_PERFORMED,
    payloadsByVersion: {
      1: {
        request: { dice: [{ sides: 6, count: 2 }] },
        dice: [
          { sides: 6, value: 4, source: { kind: 'digital' } },
          { sides: 6, value: 2, source: { kind: 'manual' } },
        ],
      },
    },
  },
  ...moduleSamples,
]);
