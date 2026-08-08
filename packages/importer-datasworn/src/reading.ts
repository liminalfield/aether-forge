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

/** The kinds of move this importer's output vocabulary distinguishes. */
export type MoveKind = 'action' | 'progress' | 'none' | 'special';

export interface DataswornMove {
  /** "starforged/adventure/face_danger", the prefix already stripped. */
  readonly id: string;
  readonly name: string;
  readonly kind: MoveKind;
  /** The stats its trigger offers, in source order, deduplicated. */
  readonly stats: readonly string[];
  /** The move's text with its outcomes appended, written to be read. */
  readonly text: string;
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
  readonly moves: readonly DataswornMove[];
  /** Move shapes this reader could not carry, by scoped id or name. */
  readonly unreadMoves: readonly string[];
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

const MOVE_KINDS: Readonly<Record<string, MoveKind>> = {
  action_roll: 'action',
  progress_roll: 'progress',
  no_roll: 'none',
  special_track: 'special',
};

function readMove(value: unknown): DataswornMove | undefined {
  if (!isRecord(value) || value['type'] !== 'move') return undefined;

  const id = readScopedId(value['_id']);
  const name = value['name'];
  const kind = MOVE_KINDS[String(value['roll_type'])];
  if (id === undefined || typeof name !== 'string' || kind === undefined) return undefined;

  const text = value['text'];
  if (typeof text !== 'string') return undefined;

  const stats: string[] = [];
  const trigger = value['trigger'];
  if (isRecord(trigger) && Array.isArray(trigger['conditions'])) {
    for (const condition of trigger['conditions']) {
      if (!isRecord(condition) || !Array.isArray(condition['roll_options'])) continue;
      for (const option of condition['roll_options']) {
        if (!isRecord(option) || option['using'] !== 'stat') continue;
        const stat = option['stat'];
        if (typeof stat === 'string' && stat !== '' && !stats.includes(stat)) stats.push(stat);
      }
    }
  }

  // The outcomes are part of what was written to be read. Kept with the
  // move's own text so the document is the whole move, not its first half.
  const parts = [text];
  const outcomes = value['outcomes'];
  if (isRecord(outcomes)) {
    const SAID: readonly [string, string][] = [
      ['strong_hit', 'On a strong hit'],
      ['weak_hit', 'On a weak hit'],
      ['miss', 'On a miss'],
    ];
    for (const [key, heading] of SAID) {
      const outcome = outcomes[key];
      if (isRecord(outcome) && typeof outcome['text'] === 'string') {
        parts.push(`**${heading}:** ${outcome['text']}`);
      }
    }
  }

  return { id, name, kind, stats, text: parts.join('\n\n') };
}

function walkMoves(value: unknown, into: DataswornMove[], unread: string[]): void {
  if (!isRecord(value)) return;

  const contents = value['contents'];
  if (isRecord(contents)) {
    for (const each of Object.values(contents)) {
      const move = readMove(each);
      if (move !== undefined) {
        into.push(move);
      } else if (isRecord(each) && each['type'] === 'move') {
        unread.push(readScopedId(each['_id']) ?? String(each['name'] ?? 'an unnamed move'));
      }
    }
  }

  const collections = value['collections'];
  if (isRecord(collections)) {
    for (const each of Object.values(collections)) walkMoves(each, into, unread);
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

  const moves: DataswornMove[] = [];
  const unreadMoves: string[] = [];
  const rawMoves = value['moves'];
  if (isRecord(rawMoves)) {
    for (const category of Object.values(rawMoves)) walkMoves(category, moves, unreadMoves);
  }

  return {
    rulesetId,
    title,
    licenseUrl,
    authors,
    dataswornVersion,
    rollables,
    moves,
    unreadMoves,
  };
}
