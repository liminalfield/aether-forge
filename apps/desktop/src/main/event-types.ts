import {
  createEventSchemas,
  type EventSchemas,
  type EventTypeDefinition,
} from '@aether-forge/core';
import { eventTypes as ironswornEventTypes } from '@aether-forge/system-ironsworn';
import { eventTypes as toyEventTypes } from '@aether-forge/system-toy';

/**
 * Every event type this build knows, and how it reads its own history.
 *
 * Core's own types are declared here. A module's are declared by the module,
 * because the module is the only thing that knows what its events mean or how
 * they have changed; the application only collects them.
 *
 * Adding a core type means adding it here and adding a sample to the test
 * beside this file. Changing an existing type means raising its version and
 * writing the translation from the previous one, never editing what it used
 * to be.
 */

/** A journal entry. Version 1 carries `{ text: string }`. */
export const ENTRY_CREATED = 'core.entry.created';

export interface EntryCreatedV1 {
  readonly text: string;
}

const coreEventTypes: readonly EventTypeDefinition[] = [
  { type: ENTRY_CREATED, currentVersion: 1, translations: [] },
];

export function declareEventTypes(): EventSchemas {
  const schemas = createEventSchemas();

  for (const definition of [...coreEventTypes, ...toyEventTypes, ...ironswornEventTypes]) {
    const declared = schemas.declare(definition);
    if (!declared.ok) {
      // Two modules claiming the same event type, or a broken translation
      // chain. Either is a mistake in this build, not a state to recover from.
      throw new Error(`cannot declare ${definition.type}: ${declared.failure.kind}`);
    }
  }

  return schemas;
}
