/**
 * Content packages: sealed boxes of game content with a label on the outside.
 *
 * Content and rules are different things. Content is what was written to be
 * read (tables, documents, entity templates); rules are what a module
 * computes. A package carries only content, in one neutral shape core
 * understands, plus a compartment core does not open (`raw`) for things only
 * the owning module can read.
 *
 * Installing a package is a fact about a machine, not a campaign, so nothing
 * here is an event. A campaign references packages only through the stamps
 * `core.oracle.consulted` records, which is what keeps an exported campaign
 * self-explaining on a machine that lacks its packages.
 *
 * The readers here are how the application trusts a package it did not build:
 * an imported file is whatever the file says until a reader has read it.
 *
 * See `design/content-packages.md`.
 */

import type { PackageId, SemVer, SystemId } from './identifiers.js';
import type { ProjectionContext } from './module-projection.js';
import type { OracleRow, PackageStamp } from './oracle.js';
import type { Result } from './result.js';
import type { DieSpec } from './roll.js';
import type { RollPerformedV1 } from './roll.js';
import type { EntityTemplate } from './template.js';

/** Where a package came from, which decides what may be done with it. */
export type PackageSource = 'bundled' | 'imported' | 'user';

/** The label on the outside of the box. */
export interface PackageManifest {
  readonly id: PackageId;
  readonly version: SemVer;
  readonly title: string;
  /** Which modules can consume it. */
  readonly systems: readonly SystemId[];
  /** SPDX expression. Machine-readable, because the posture is enforced. */
  readonly license: string;
  /** Rendered by the application. CC-BY requires it, so it is carried, not linked. */
  readonly attribution?: string;
  readonly source: PackageSource;
  /** Hash of the canonicalised content, stamped when the box is sealed. */
  readonly contentHash: string;
}

/**
 * A table an oracle answers from.
 *
 * Rows carry ranges as well as texts because `core.oracle.consulted` records
 * the row a number landed on, range and all, and the two shapes have to
 * agree. Rows are not required to tile the dice range: content is recorded as
 * its publisher wrote it, gaps and all, and a number that lands nowhere is
 * the resolver's honest answer, not a broken table.
 */
export interface OracleTable {
  /** Stable and package-scoped: "example.tables/what-the-silence-holds". */
  readonly id: string;
  readonly name: string;
  readonly dice: DieSpec;
  readonly rows: readonly OracleRow[];
}

/** A piece of content that was written to be read: move text, rules reference. */
export interface ReferenceDoc {
  /** Stable and package-scoped, so anything can link to it. */
  readonly id: string;
  readonly title: string;
  /** The text, keeping the source's structure as faithfully as the importer manages. */
  readonly text: string;
}

/** The sealed box. */
export interface ContentPackage {
  readonly manifest: PackageManifest;
  readonly tables: readonly OracleTable[];
  readonly documents: readonly ReferenceDoc[];
  readonly entityTemplates: readonly EntityTemplate[];
  /** The compartment core does not open. Only the owning module reads it. */
  readonly raw?: unknown;
}

/**
 * What consulting a table answers with: everything the consultation event
 * needs, so writing the event is transcription rather than assembly.
 */
export interface OracleOutcome {
  readonly row: OracleRow;
  readonly tableId: string;
  readonly package: PackageStamp;
  /** Tables the content suggests consulting next. For a surface, later. */
  readonly followUps?: readonly string[];
}

export type OracleFailure =
  | { readonly kind: 'unknown-table'; readonly tableId: string }
  | { readonly kind: 'no-row-at'; readonly tableId: string; readonly landed: number };

/**
 * Something that resolves consultations. It never rolls: rolling belongs to
 * the roll machinery, which is what makes a typed-in d100 identical to a
 * rolled one against every provider.
 */
export interface OracleProvider {
  readonly id: string;
  listTables(context: ProjectionContext): readonly OracleTable[];
  resolve(
    tableId: string,
    roll: RollPerformedV1,
    context: ProjectionContext,
  ): Result<OracleOutcome, OracleFailure>;
}

/**
 * The row a total lands on, or undefined when it lands nowhere.
 *
 * Rows are searched as written. Content with overlapping ranges answers with
 * the first row that matches, because answering with something the publisher
 * wrote beats refusing to answer at all; content with gaps answers nothing
 * for the gap, which is the honest reading of a table that skips numbers.
 */
export function rowFor(table: OracleTable, landed: number): OracleRow | undefined {
  return table.rows.find((row) => row.from <= landed && landed <= row.to);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

function readRow(value: unknown): OracleRow | undefined {
  if (!isRecord(value)) return undefined;
  const { from, to, text } = value;
  if (typeof from !== 'number' || !Number.isInteger(from)) return undefined;
  if (typeof to !== 'number' || !Number.isInteger(to) || to < from) return undefined;
  if (typeof text !== 'string') return undefined;
  return { from, to, text };
}

function readDice(value: unknown): DieSpec | undefined {
  if (!isRecord(value)) return undefined;
  const { sides, count } = value;
  if (typeof sides !== 'number' || !Number.isInteger(sides) || sides < 1) return undefined;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) return undefined;
  const label = value['label'];
  if (label === undefined) return { sides, count };
  return isNonEmptyString(label) ? { sides, count, label } : undefined;
}

export function readOracleTable(value: unknown): OracleTable | undefined {
  if (!isRecord(value)) return undefined;
  if (!isNonEmptyString(value['id']) || !isNonEmptyString(value['name'])) return undefined;

  const dice = readDice(value['dice']);
  if (dice === undefined) return undefined;

  const rows = value['rows'];
  if (!Array.isArray(rows)) return undefined;
  const read = rows.map(readRow);
  if (read.some((row) => row === undefined)) return undefined;

  return { id: value['id'], name: value['name'], dice, rows: read as OracleRow[] };
}

export function readReferenceDoc(value: unknown): ReferenceDoc | undefined {
  if (!isRecord(value)) return undefined;
  if (!isNonEmptyString(value['id']) || !isNonEmptyString(value['title'])) return undefined;
  if (typeof value['text'] !== 'string') return undefined;
  return { id: value['id'], title: value['title'], text: value['text'] };
}

const SOURCES: readonly PackageSource[] = ['bundled', 'imported', 'user'];

export function readManifest(value: unknown): PackageManifest | undefined {
  if (!isRecord(value)) return undefined;

  const { id, version, title, license, contentHash } = value;
  if (!isNonEmptyString(id) || !isNonEmptyString(version)) return undefined;
  if (!isNonEmptyString(title) || !isNonEmptyString(license)) return undefined;
  if (!isNonEmptyString(contentHash)) return undefined;

  const systems = value['systems'];
  if (!Array.isArray(systems) || !systems.every(isNonEmptyString)) return undefined;

  const source = value['source'];
  if (!SOURCES.includes(source as PackageSource)) return undefined;

  const attribution = value['attribution'];
  if (attribution !== undefined && !isNonEmptyString(attribution)) return undefined;

  const manifest: PackageManifest = {
    id,
    version,
    title,
    systems: systems as string[],
    license,
    source: source as PackageSource,
    contentHash,
  };
  return attribution === undefined ? manifest : { ...manifest, attribution };
}

function readEach<Item>(
  value: unknown,
  read: (each: unknown) => Item | undefined,
): readonly Item[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.map(read);
  return items.some((item) => item === undefined) ? undefined : (items as Item[]);
}

function readTemplate(value: unknown): EntityTemplate | undefined {
  if (!isRecord(value)) return undefined;
  if (!isNonEmptyString(value['typeId']) || !isNonEmptyString(value['name'])) return undefined;
  if (!Array.isArray(value['fields']) || !Array.isArray(value['tracks'])) return undefined;
  // Shape only; whether it describes recordable entities is the module's own
  // test, via describesRecordableEntities, and a package is content either way.
  return value as unknown as EntityTemplate;
}

/**
 * A whole package, read from bytes the application did not write.
 *
 * `raw` passes through unread, which is the point of the compartment: core
 * carries it and only the owning module can make anything of it.
 */
export function readContentPackage(value: unknown): ContentPackage | undefined {
  if (!isRecord(value)) return undefined;

  const manifest = readManifest(value['manifest']);
  if (manifest === undefined) return undefined;

  const tables = readEach(value['tables'], readOracleTable);
  if (tables === undefined) return undefined;

  const documents = readEach(value['documents'], readReferenceDoc);
  if (documents === undefined) return undefined;

  const entityTemplates = readEach(value['entityTemplates'], readTemplate);
  if (entityTemplates === undefined) return undefined;

  const box: ContentPackage = { manifest, tables, documents, entityTemplates };
  return value['raw'] === undefined ? box : { ...box, raw: value['raw'] };
}
