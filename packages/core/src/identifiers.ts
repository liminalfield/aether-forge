/**
 * The identifiers used throughout the campaign log.
 *
 * These are aliases rather than distinct types. That is a deliberate choice for
 * now: making them mutually incompatible would catch a real class of mistake,
 * and it would also mean every identifier needs constructing rather than being
 * read straight out of storage. Revisit it if the mistake actually happens.
 */

/** Identifies one campaign. */
export type CampaignId = string;

/** Identifies one recorded event. Unique across a campaign, and sortable. */
export type EventId = string;

/** Identifies one entity: a person, a place, a faction, a thread. */
export type EntityId = string;

/** Identifies a system module, for example `toy-coinflip`. */
export type SystemId = string;

/** Identifies a content package, for example `publisher.setting-tables`. */
export type PackageId = string;

/** A semantic version string, for example `1.4.0`. */
export type SemVer = string;

/**
 * Anything written into the log records which version of its shape was used.
 *
 * Shapes change over the life of a project, and campaigns outlive releases. A
 * recorded version is what lets an old event be translated into the current
 * shape when it is read, instead of the log being rewritten to suit new code.
 */
export interface Versioned {
  readonly schemaVersion: number;
}
