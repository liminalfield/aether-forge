/**
 * `@aether-forge/core`: the system-neutral kernel.
 *
 * Vocabulary rule: nothing in this package may use a word that appears in a
 * rulebook. Allowed vocabulary is journal, entry, event, roll, table, entity,
 * relation, track, clock, resource, module, package, flow. If a name comes from
 * a game system, it belongs in a `system-*` module instead.
 *
 * This is the bootstrap seed: identifiers and versioning only. The event
 * envelope, entity graph and flow engine arrive with the first feature
 * milestone (see 02-MODULE-CONTRACT.md).
 */

/** Version of the module contract this package implements. */
export const CORE_CONTRACT_VERSION = 1;

export type CampaignId = string;
export type EventId = string;
export type EntityId = string;
export type SystemId = string;
export type PackageId = string;
export type SemVer = string;

/**
 * Every type that crosses the log boundary carries its own schema version, from
 * the first event ever written. Migration happens by upcasting on read; the log
 * is never rewritten.
 */
export interface Versioned {
  readonly schemaVersion: number;
}
