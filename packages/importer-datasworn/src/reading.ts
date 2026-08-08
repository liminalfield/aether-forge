/**
 * Reading Datasworn, narrowly.
 *
 * This file names Datasworn's concepts, which nothing outside this package may
 * do. The shapes here are not Datasworn's full types: they are exactly the
 * parts this importer consumes, read from `unknown` the way core reads
 * payloads, because a file somebody hands the runtime import flow is whatever
 * the file says until a reader has read it.
 */

export interface DataswornRow {
  readonly min: number;
  readonly max: number;
  readonly text: string;
}

export interface DataswornRollable {
  /** "starforged/core/action", the prefix already stripped. */
  readonly id: string;
  readonly name: string;
  readonly sides: number;
  readonly count: number;
  readonly rows: readonly DataswornRow[];
  /** How many rows carried no roll range and were left out. */
  readonly rowsWithoutRanges: number;
}

export interface DataswornRuleset {
  /** "starforged" */
  readonly rulesetId: string;
  readonly title: string;
  /** The license as Datasworn states it, which is a URL. */
  readonly licenseUrl: string;
  readonly authors: readonly string[];
  readonly dataswornVersion: string;
  readonly rollables: readonly DataswornRollable[];
  /** Raw subtrees this importer does not consume yet, kept for later stages. */
  readonly moves: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** "1d100" as a shape, or nothing for a form this importer has not met. */
function readDiceExpression(value: unknown): { sides: number; count: number } | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /^(\d+)d(\d+)$/.exec(value);
  if (match === null) return undefined;

  const count = Number(match[1]);
  const sides = Number(match[2]);
  if (count < 1 || sides < 1) return undefined;
  return { sides, count };
}

/** "oracle_rollable:starforged/core/action" without its kind prefix. */
function readScopedId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const at = value.indexOf(':');
  const scoped = at === -1 ? value : value.slice(at + 1);
  return scoped === '' ? undefined : scoped;
}

function readRollable(value: unknown): DataswornRollable | undefined {
  if (!isRecord(value) || value['type'] !== 'oracle_rollable') return undefined;

  const id = readScopedId(value['_id']);
  const name = value['name'];
  const dice = readDiceExpression(value['dice']);
  if (id === undefined || typeof name !== 'string' || dice === undefined) return undefined;

  const rawRows = value['rows'];
  if (!Array.isArray(rawRows)) return undefined;

  const rows: DataswornRow[] = [];
  let rowsWithoutRanges = 0;
  for (const raw of rawRows) {
    if (!isRecord(raw) || typeof raw['text'] !== 'string') return undefined;
    const roll = raw['roll'];
    if (roll === null || roll === undefined) {
      // A row nothing can land on. Real in the corpus (flavour rows), counted
      // so the conversion can say what it left out rather than hiding it.
      rowsWithoutRanges += 1;
      continue;
    }
    if (!isRecord(roll)) return undefined;
    const { min, max } = roll;
    if (typeof min !== 'number' || typeof max !== 'number') return undefined;
    rows.push({ min, max, text: raw['text'] });
  }

  return { id, name, sides: dice.sides, count: dice.count, rows, rowsWithoutRanges };
}

/** Every rollable in a collection tree, depth first, in source order. */
function walkCollections(value: unknown, into: DataswornRollable[]): void {
  if (!isRecord(value)) return;

  const contents = value['contents'];
  if (isRecord(contents)) {
    for (const each of Object.values(contents)) {
      const rollable = readRollable(each);
      if (rollable !== undefined) into.push(rollable);
    }
  }

  const collections = value['collections'];
  if (isRecord(collections)) {
    for (const each of Object.values(collections)) walkCollections(each, into);
  }
}

export function readRuleset(value: unknown): DataswornRuleset | undefined {
  if (!isRecord(value) || value['type'] !== 'ruleset') return undefined;

  const rulesetId = value['_id'];
  const title = value['title'];
  const licenseUrl = value['license'];
  const dataswornVersion = value['datasworn_version'];
  if (typeof rulesetId !== 'string' || rulesetId === '') return undefined;
  if (typeof title !== 'string' || typeof licenseUrl !== 'string') return undefined;
  if (typeof dataswornVersion !== 'string') return undefined;

  const rawAuthors = value['authors'];
  const authors = Array.isArray(rawAuthors)
    ? rawAuthors.flatMap((each) =>
        isRecord(each) && typeof each['name'] === 'string' ? [each['name']] : [],
      )
    : [];

  const rollables: DataswornRollable[] = [];
  const oracles = value['oracles'];
  if (isRecord(oracles)) {
    for (const collection of Object.values(oracles)) walkCollections(collection, rollables);
  }

  return {
    rulesetId,
    title,
    licenseUrl,
    authors,
    dataswornVersion,
    rollables,
    moves: value['moves'],
  };
}
