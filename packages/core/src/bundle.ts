/**
 * Carrying a campaign to another machine, and bringing it home.
 *
 * Not syncing. Nothing happens automatically, nothing runs in the background,
 * and nothing talks to a server. It is a file you move when you decide to.
 *
 * The part that needed designing is the return trip, because by then two copies
 * exist and both may have been played. Numbered events that never change make
 * that cheap to work out: compare the copies event by event and see where they
 * stop agreeing.
 *
 * See `design/event-log-and-projections.md`.
 */

import type { EventEnvelope } from './event.js';
import type { CampaignId } from './identifiers.js';
import type { EventLog, LogFailure } from './log.js';
import { failed, ok, type Result } from './result.js';

/** The shape of a bundle. Raised only if the shape itself changes. */
export const BUNDLE_FORMAT = 1;

export interface CampaignBundle {
  readonly format: number;
  readonly campaignId: CampaignId;
  readonly exportedAt: string;
  /**
   * A short summary of the history in this bundle.
   *
   * Not for security, and not a checksum of the file. It exists so that two
   * campaigns which merely share an identifier are never mistaken for the same
   * campaign, and so that a person can see at a glance whether two copies came
   * from the same place.
   */
  readonly fingerprint: string;
  /**
   * Events exactly as they are stored, not brought up to date.
   *
   * The machine receiving this may be running an older or newer build, and
   * translation happens when a campaign is read, never when it is written. A
   * bundle carrying translated events would quietly rewrite history in transit.
   */
  readonly events: readonly EventEnvelope[];
}

/** A deterministic, non-cryptographic hash. Same input, same answer, anywhere. */
function hash(text: string, seed: number): string {
  let value = seed;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value.toString(16).padStart(8, '0');
}

/**
 * Summarise a history by the identifiers in it, in order.
 *
 * Identifiers are unique and never change, so two logs with the same sequence
 * of them hold the same events.
 */
export function fingerprintOf(events: readonly EventEnvelope[]): string {
  const identity = events.map((event) => `${event.seq}:${event.id}`).join('\n');
  return `${hash(identity, 0x811c9dc5)}${hash(identity, 0x2fd0f57b)}`;
}

export function exportCampaign(
  log: EventLog,
  exportedAt: string,
): Result<CampaignBundle, LogFailure> {
  const events = log.read();
  if (!events.ok) return events;

  return ok({
    format: BUNDLE_FORMAT,
    campaignId: log.campaignId,
    exportedAt,
    fingerprint: fingerprintOf(events.value),
    events: events.value,
  });
}

export type HistoryComparison =
  /** Both copies hold exactly the same events. Nothing to do. */
  | { readonly kind: 'already-up-to-date' }
  /** The bundle carries events this copy does not have. The ordinary case. */
  | { readonly kind: 'behind'; readonly missing: readonly EventEnvelope[] }
  /** This copy has everything in the bundle, and more. Nothing to do. */
  | { readonly kind: 'ahead' }
  /** Both were played after they parted. They cannot be combined. */
  | {
      readonly kind: 'diverged';
      /** The last position at which the two still agreed. */
      readonly agreedUntil: number;
    }
  /** Same identifier, different campaign. They share no history at all. */
  | { readonly kind: 'a-different-campaign' };

/**
 * Work out how a bundle relates to the campaign already here.
 *
 * Compares position by position. Identifiers are unique and permanent, so the
 * first position where they differ is the point the two copies parted.
 */
export function compareHistories(
  here: readonly EventEnvelope[],
  bundle: CampaignBundle,
): HistoryComparison {
  const there = bundle.events;

  let agreed = 0;
  const shortest = Math.min(here.length, there.length);
  while (agreed < shortest && here[agreed]?.id === there[agreed]?.id) agreed += 1;

  if (agreed === 0 && here.length > 0 && there.length > 0) {
    return { kind: 'a-different-campaign' };
  }

  if (agreed < here.length && agreed < there.length) {
    return { kind: 'diverged', agreedUntil: agreed };
  }

  if (there.length > here.length) {
    return { kind: 'behind', missing: there.slice(agreed) };
  }

  return here.length > there.length ? { kind: 'ahead' } : { kind: 'already-up-to-date' };
}

export type ImportFailure =
  | LogFailure
  | { readonly kind: 'unknown-bundle-format'; readonly format: number }
  | { readonly kind: 'a-different-campaign'; readonly campaignId: CampaignId }
  | { readonly kind: 'diverged'; readonly agreedUntil: number };

export interface ImportOutcome {
  /** How many events were taken from the bundle. */
  readonly restored: number;
}

/**
 * Take everything from a bundle that this copy is missing.
 *
 * Succeeds only when one side moved on and the other did not, which is what
 * happens when a campaign is carried somewhere, played, and brought home.
 *
 * When both were played it refuses. Combining them is the merging problem this
 * design declines to take on, and guessing quietly would be worse than saying
 * so. The caller keeps the bundle as a separate campaign instead.
 */
export function importCampaign(
  log: EventLog,
  bundle: CampaignBundle,
): Result<ImportOutcome, ImportFailure> {
  if (bundle.format !== BUNDLE_FORMAT) {
    return failed({ kind: 'unknown-bundle-format', format: bundle.format });
  }

  if (bundle.campaignId !== log.campaignId) {
    return failed({ kind: 'a-different-campaign', campaignId: bundle.campaignId });
  }

  const here = log.read();
  if (!here.ok) return here;

  const comparison = compareHistories(here.value, bundle);

  switch (comparison.kind) {
    case 'a-different-campaign':
      return failed({ kind: 'a-different-campaign', campaignId: bundle.campaignId });

    case 'diverged':
      return failed({ kind: 'diverged', agreedUntil: comparison.agreedUntil });

    case 'ahead':
    case 'already-up-to-date':
      return ok({ restored: 0 });

    case 'behind': {
      for (const event of comparison.missing) {
        const restored = log.restore(event);
        if (!restored.ok) return restored;
      }
      return ok({ restored: comparison.missing.length });
    }
  }
}
