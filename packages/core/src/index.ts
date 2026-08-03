/**
 * `@aether-forge/core`: the system-neutral kernel.
 *
 * Vocabulary rule: nothing in this package may use a word that appears in a
 * rulebook. Allowed vocabulary is journal, entry, event, roll, table, entity,
 * relation, track, clock, resource, module, package, flow. If a name comes from
 * a game system, it belongs in a `system-*` module instead.
 *
 * Core also touches no platform. No filesystem, no network, no Electron. It
 * describes what a log has to be able to do; the desktop application supplies
 * the implementation.
 */

/** Version of the module contract this package implements. */
export const CORE_CONTRACT_VERSION = 1;

export type {
  CampaignId,
  EntityId,
  EventId,
  PackageId,
  SemVer,
  SystemId,
  Versioned,
} from './identifiers.js';

export type {
  CoreEvent,
  CoreEventType,
  EventEnvelope,
  EventType,
  ModuleEvent,
  ModuleEventType,
} from './event.js';

export { isCoreEvent, isModuleEvent } from './event.js';
