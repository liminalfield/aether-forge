import { createEventSchemas, type EventSchemas } from '@aether-forge/core';

/**
 * Every event type this build knows, and how it reads its own history.
 *
 * One place, so that "which shapes does this version understand" has a single
 * answer, and so that the check walking every version from 1 to current has
 * something real to walk.
 *
 * Adding a type means adding it here and adding a sample to the test beside
 * this file. Changing an existing type means raising its version and writing
 * the translation from the previous one, never editing what it used to be.
 */

/** A journal entry. Version 1 carries `{ text: string }`. */
export const ENTRY_CREATED = 'core.entry.created';

export interface EntryCreatedV1 {
  readonly text: string;
}

export function declareEventTypes(): EventSchemas {
  const schemas = createEventSchemas();

  schemas.declare({
    type: ENTRY_CREATED,
    currentVersion: 1,
    translations: [],
  });

  return schemas;
}
