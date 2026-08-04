import { describeSchemaTranslations } from '@aether-forge/core/testing';

import { declareEventTypes, ENTRY_CREATED } from './event-types';

/**
 * Walks every declared event type from version 1 to whatever it is on now.
 *
 * Trivial today, because nothing has changed shape yet. It is here now so that
 * it is already in place on the day something does, which is the day it stops
 * being possible to add it honestly.
 */
describeSchemaTranslations('this build', declareEventTypes, [
  {
    type: ENTRY_CREATED,
    payloadsByVersion: {
      1: { text: 'The airlock did not open.' },
    },
  },
]);
