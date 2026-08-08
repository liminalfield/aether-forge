/**
 * `@aether-forge/importer-datasworn`: Datasworn to neutral ContentPackage.
 *
 * Datasworn is an interchange format this project consumes, never its runtime
 * model. This package is the only place in the repository allowed to name a
 * Datasworn concept. One implementation serves both build-time bundling and
 * runtime user imports, so both paths produce identical output, and the
 * golden files are its real specification.
 *
 * The `@datasworn-community/*` packages are pinned to exact versions and
 * excluded from automated dependency bumps: a version change is a
 * content-model change and arrives in its own PR with regenerated goldens.
 *
 * See `design/content-packages.md`.
 */

import {
  failed,
  ok,
  type ContentPackage,
  type OracleTable,
  type PackageManifest,
  type PackageSource,
  type Result,
  type SemVer,
} from '@aether-forge/core';

import { readRuleset } from './reading.js';

/** Format version of the importer's output, independent of Datasworn's. */
export const IMPORTER_OUTPUT_VERSION = 1;

/** Something the conversion left out or worked around, said rather than hidden. */
export interface ImportProblem {
  readonly at: string;
  readonly detail: string;
}

export interface Imported {
  readonly package: ContentPackage;
  /** Empty on a clean conversion. What was dropped is here, never hidden. */
  readonly problems: readonly ImportProblem[];
}

export type ImportRefused = { readonly kind: 'not-a-ruleset'; readonly detail: string };

export interface ImportOptions {
  /** The version of the source package, which the manifest carries for stamps. */
  readonly version: SemVer;
  readonly source: PackageSource;
}

/**
 * The license as Datasworn states it (a URL), as SPDX where the URL is one
 * this project knows. An unknown URL passes through as itself: the manifest's
 * license is a statement of fact, and the bundling gate, not this function,
 * decides what may ship.
 */
function asSpdx(licenseUrl: string): string {
  const KNOWN: Readonly<Record<string, string>> = {
    'https://creativecommons.org/licenses/by/4.0': 'CC-BY-4.0',
    'https://creativecommons.org/licenses/by-nc/4.0': 'CC-BY-NC-4.0',
  };
  return KNOWN[licenseUrl.replace(/\/$/, '')] ?? licenseUrl;
}

/**
 * SHA-256 as a hex string, through the Web Crypto global.
 *
 * The global rather than `node:crypto`, because libraries stay
 * platform-neutral by law here, and `crypto.subtle` is the one hashing
 * surface every runtime this code meets provides without an import. It is
 * why importing is asynchronous. The declarations are the two corners of
 * the standard globals this file touches, narrow on purpose: the platform
 * lib is not loaded here, and widening the whole type surface to get two
 * names would invite the imports the law forbids.
 */
declare const crypto: {
  readonly subtle: { digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer> };
};
declare class TextEncoder {
  encode(text: string): Uint8Array;
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * One stable stringification, so the same content always hashes the same.
 * Keys are sorted at every depth; nothing else is touched.
 */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, held: unknown) => {
    if (typeof held !== 'object' || held === null || Array.isArray(held)) return held;
    return Object.fromEntries(
      Object.entries(held as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)),
    );
  });
}

/**
 * Datasworn JSON in, a sealed neutral package out.
 *
 * The conversion is honest about what it does not carry: a row nothing can
 * land on, or a shape this importer has not met, becomes a problem in the
 * result rather than a silent absence.
 */
export async function importDatasworn(
  value: unknown,
  options: ImportOptions,
): Promise<Result<Imported, ImportRefused>> {
  const ruleset = readRuleset(value);
  if (ruleset === undefined) {
    return failed({ kind: 'not-a-ruleset', detail: 'this is not a Datasworn ruleset document' });
  }

  const problems: ImportProblem[] = [];

  const tables: OracleTable[] = ruleset.rollables.map((rollable) => {
    if (rollable.rowsWithoutRanges > 0) {
      problems.push({
        at: rollable.id,
        detail: `${String(rollable.rowsWithoutRanges)} rows have no roll range and were left out`,
      });
    }
    return {
      id: rollable.id,
      name: rollable.name,
      dice: { sides: rollable.sides, count: rollable.count },
      rows: rollable.rows.map((row) => ({ from: row.min, to: row.max, text: row.text })),
    };
  });

  for (const unread of ruleset.unreadMoves) {
    problems.push({ at: unread, detail: 'this move has a shape the importer has not met' });
  }

  const documents = ruleset.moves.map((move) => ({
    id: move.id,
    title: move.name,
    text: move.text,
  }));

  const attribution =
    ruleset.authors.length === 0
      ? `${ruleset.title}, used under ${asSpdx(ruleset.licenseUrl)}.`
      : `${ruleset.title} is by ${ruleset.authors.join(', ')}, used under ${asSpdx(ruleset.licenseUrl)}.`;

  // The module's compartment: structured facts about the moves, in this
  // importer's own output vocabulary, for the owning module to join to its
  // interpreters. Core carries this unread.
  const raw = {
    formatVersion: IMPORTER_OUTPUT_VERSION,
    moves: ruleset.moves.map((move) => ({
      id: move.id,
      name: move.name,
      kind: move.kind,
      stats: move.stats,
    })),
  };

  const content = { tables, documents, entityTemplates: [], raw };

  // Which module consumes a ruleset is knowledge, not derivation. A ruleset
  // this map does not know still imports; it is compatible with a system of
  // its own name until a module claims it, and the problem list says so.
  const SYSTEMS: Readonly<Record<string, string>> = { starforged: 'ironsworn-starforged' };
  const system = SYSTEMS[ruleset.rulesetId];
  if (system === undefined) {
    problems.push({
      at: ruleset.rulesetId,
      detail: 'no loaded system is known for this ruleset; it is importable but unclaimed',
    });
  }

  const manifest: PackageManifest = {
    id: `datasworn-community.${ruleset.rulesetId}`,
    version: options.version,
    title: ruleset.title,
    systems: [system ?? ruleset.rulesetId],
    license: asSpdx(ruleset.licenseUrl),
    attribution,
    source: options.source,
    contentHash: `sha256-${await sha256(canonical(content))}`,
  };

  return ok({ package: { manifest, ...content }, problems });
}
