import {
  createEventSchemas,
  journalEventTypes,
  oracleEventTypes,
  rollEventTypes,
  suggestionEventTypes,
  type EventSchemas,
  type EventTypeDefinition,
} from '@aether-forge/core';
import { eventTypes as ironswornEventTypes } from '@aether-forge/system-ironsworn';
import { eventTypes as toyEventTypes } from '@aether-forge/system-toy';

/**
 * Every event type this build knows, and how it reads its own history.
 *
 * Nothing is declared here. Core declares the shapes it owns and each module
 * declares its own, because in both cases that is the only place that knows
 * what the events mean or how they have changed. The application collects them.
 */
export function declareEventTypes(): EventSchemas {
  const schemas = createEventSchemas();

  const everything: readonly EventTypeDefinition[] = [
    ...journalEventTypes,
    ...rollEventTypes,
    ...oracleEventTypes,
    ...suggestionEventTypes,
    ...toyEventTypes,
    ...ironswornEventTypes,
  ];

  for (const definition of everything) {
    const declared = schemas.declare(definition);
    if (!declared.ok) {
      // Two modules claiming the same event type, or a broken translation
      // chain. Either is a mistake in this build, not a state to recover from.
      throw new Error(`cannot declare ${definition.type}: ${declared.failure.kind}`);
    }
  }

  return schemas;
}
