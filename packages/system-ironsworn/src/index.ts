/**
 * `@aether-forge/system-ironsworn`: the Ironsworn and Ironsworn: Starforged
 * system module.
 *
 * This is where rulebook vocabulary is allowed to live. Content arrives as
 * neutral ContentPackages produced by `@aether-forge/importer-datasworn`; this
 * module never sees Datasworn types.
 */

import {
  CORE_CONTRACT_VERSION,
  readRoll,
  type CheckDefinition,
  type CheckOutcome,
  type OutcomeStyle,
  type EffectSuggestion,
  type EntityTemplate,
  type EventTypeDefinition,
  type FieldSpec,
  type ModuleProjection,
  type RollPerformedV1,
  type SystemId,
} from '@aether-forge/core';

export const STARFORGED_SYSTEM_ID: SystemId = 'ironsworn-starforged';
export const IRONSWORN_SYSTEM_ID: SystemId = 'ironsworn-classic';

/** The contract version this module was written against. */
export const COMPATIBLE_CORE_CONTRACT_VERSION = CORE_CONTRACT_VERSION;

/** Momentum moved. Carries the change, never the resulting value. */
export const MOMENTUM_CHANGED = 'sys.ironsworn-starforged.momentum.changed';

export interface MomentumChanged {
  /** How far it moved, positive or negative. */
  readonly by: number;
  /** Why, for the log to read back sensibly. */
  readonly reason?: string;
}

function isMomentumChanged(payload: unknown): payload is MomentumChanged {
  if (typeof payload !== 'object' || payload === null) return false;
  const by = (payload as { by?: unknown }).by;
  return typeof by === 'number' && Number.isFinite(by);
}

/** Where a character's momentum starts. A rule, so it lives in the module. */
export const STARTING_MOMENTUM = 2;

export interface Momentum {
  readonly current: number;
  /** The furthest it has been in each direction, for reading the log back. */
  readonly highest: number;
  readonly lowest: number;
  readonly changes: number;
}

/**
 * Momentum, as the sum of every recorded change.
 *
 * **It is not capped here, deliberately.** The rules put a ceiling on momentum,
 * and that ceiling belongs to what the application *suggests*, not to what it
 * records. A player who decides their momentum is 12 has decided that, and the
 * log says so. Clamping here would quietly overrule them and the log would then
 * disagree with itself: the events would add up to one number and the state
 * would show another.
 *
 * This is the sovereignty rule in one function.
 */
export const momentum: ModuleProjection<Momentum> = {
  id: 'sys.ironsworn-starforged.momentum',
  systemId: STARFORGED_SYSTEM_ID,

  initial: () => ({
    current: STARTING_MOMENTUM,
    highest: STARTING_MOMENTUM,
    lowest: STARTING_MOMENTUM,
    changes: 0,
  }),

  apply: (state, event) => {
    if (event.type !== MOMENTUM_CHANGED || !isMomentumChanged(event.payload)) return state;

    const current = state.current + event.payload.by;

    return {
      current,
      highest: Math.max(state.highest, current),
      lowest: Math.min(state.lowest, current),
      changes: state.changes + 1,
    };
  },
};

/**
 * The event shapes this module owns, and how it reads its own history.
 *
 * Declared by the module rather than by the application, because the module is
 * the only thing that knows what its events mean or how they have changed.
 */
/** The two event types a check writes either side of its roll. */
export const MOVE_INVOKED = 'sys.ironsworn-starforged.move.invoked';
export const MOVE_RESOLVED = 'sys.ironsworn-starforged.move.resolved';

export const eventTypes: readonly EventTypeDefinition[] = [
  {
    type: MOMENTUM_CHANGED,
    currentVersion: 1,
    translations: [],
    // Momentum moving by two happened. Correcting it means moving it back,
    // not pretending it moved by something else.
    corrections: 'records-a-change',
  },
  // Both say what the check ran with and what it came to, so both can be
  // restated. Neither records a change to anything.
  { type: MOVE_INVOKED, currentVersion: 1, translations: [], corrections: 'replaces-a-value' },
  { type: MOVE_RESOLVED, currentVersion: 1, translations: [], corrections: 'replaces-a-value' },
];

/**
 * The stats a character rolls with.
 *
 * Rulebook vocabulary, which is exactly why it lives here and not in core.
 */
export const STATS = ['edge', 'heart', 'iron', 'shadow', 'wits'] as const;

/**
 * Face Danger, as a check.
 *
 * The first check with everything in it: a choice the application has an
 * opinion about, dice, an interpretation, and a proposed effect the player can
 * change or refuse.
 *
 * The action die is added to the stat and any bonus, and the total is compared
 * against each challenge die. Beating both is a strong hit, beating one is a
 * weak hit, beating neither is a miss.
 */
/**
 * Every result this check can produce, and how each is shown.
 *
 * The labels live here rather than in `interpret`, so the word a person sees
 * while they roll and the word they see reading it back next year cannot drift
 * apart. `interpret` looks its own entry up.
 *
 * `unreadable` is shown the way a failure is. It is not one, and there is no
 * fifth colour: four is what a person can learn, and inventing one for a state
 * that only happens when something has gone wrong would spend it badly.
 */
const FACE_DANGER_OUTCOMES: readonly OutcomeStyle[] = [
  { id: 'strong-hit', label: 'Strong hit', tone: 'strong', glyph: '\u25C6' },
  { id: 'weak-hit', label: 'Weak hit', tone: 'weak', glyph: '\u25C7' },
  { id: 'miss', label: 'Miss', tone: 'miss', glyph: '\u25B3' },
  { id: 'unreadable', label: 'Unreadable', tone: 'miss', glyph: '\u003F' },
];

/** The declared label for a result, so no result is named twice. */
function labelled(id: string): string {
  return FACE_DANGER_OUTCOMES.find((style) => style.id === id)?.label ?? id;
}

export const FACE_DANGER: CheckDefinition = {
  id: 'starforged/moves/adventure/face_danger',
  name: 'Face Danger',

  roll: {
    dice: [
      { sides: 6, count: 1, label: 'action' },
      { sides: 10, count: 2, label: 'challenge' },
    ],
  },

  // The challenge dice are what the result turned on: the action side is what
  // you brought, the challenge dice are what the world answered with.
  decisive: 'challenge',

  outcomes: FACE_DANGER_OUTCOMES,

  inputs: [
    {
      id: 'stat',
      label: 'Stat',
      kind: 'choice',
      source: 'chosen',
      options: STATS.map((stat) => ({ id: stat, label: stat, value: 0 })),
    },
    { id: 'bonus', label: 'Bonus', kind: 'number', source: 'chosen' },
  ],

  interpret: (roll, inputs) => interpretFaceDanger(roll, inputs),
};

/** Everything the check offers. One is enough to prove the shape carries a real system. */
export const checks: readonly CheckDefinition[] = [FACE_DANGER];

function interpretFaceDanger(
  roll: RollPerformedV1 | null,
  inputs: Readonly<Record<string, number>>,
): CheckOutcome {
  const read = roll === null ? undefined : readRoll(roll);
  const action = read?.dice[0];
  const challenge = read?.dice.slice(1) ?? [];

  if (action === undefined || challenge.length !== 2) {
    return {
      id: 'unreadable',
      label: labelled('unreadable'),
      summary: 'That roll was not an action roll.',
      suggests: [],
    };
  }

  const total = action.value + (inputs['stat'] ?? 0) + (inputs['bonus'] ?? 0);
  const beaten = challenge.filter((die) => total > die.value).length;

  if (beaten === 2) {
    return {
      id: 'strong-hit',
      label: labelled('strong-hit'),
      summary: 'You do it, and you are in control.',
      suggests: [momentumSuggestion(1, 'a clean success')],
    };
  }

  if (beaten === 1) {
    return {
      id: 'weak-hit',
      label: labelled('weak-hit'),
      summary: 'You do it, but at a cost.',
      suggests: [momentumSuggestion(-1, 'a cost paid')],
    };
  }

  return {
    id: 'miss',
    label: labelled('miss'),
    summary: 'It goes badly.',
    suggests: [momentumSuggestion(-2, 'it went badly')],
  };
}

/**
 * What the module proposes doing about an outcome.
 *
 * Every field of the proposal is described, because the contract requires it. A
 * proposal describing only some of its payload would be adjustable in parts,
 * and a player pressing adjust would be guessing at which parts.
 */
function momentumSuggestion(by: number, reason: string): EffectSuggestion {
  return {
    id: `${FACE_DANGER.id}#momentum`,
    label: `Momentum ${by > 0 ? '+' : ''}${by}`,
    fields: [
      { id: 'by', label: 'Amount', kind: 'number' as const },
      { id: 'reason', label: 'Reason', kind: 'text' as const },
    ],
    proposes: {
      type: MOMENTUM_CHANGED,
      systemId: STARFORGED_SYSTEM_ID,
      payload: { by, reason },
    },
  };
}

/**
 * The entities this system is about.
 *
 * A template describes what a new one starts with and never enforces
 * anything. Momentum is deliberately not a track here: it is module state
 * with its own projection, because burning and resetting it are rules, not
 * marks on a row of segments.
 */
export const CHARACTER_TEMPLATE: EntityTemplate = {
  typeId: `sys.${STARFORGED_SYSTEM_ID}.character`,
  name: 'Character',
  fields: [
    { id: 'name', label: 'Name', kind: 'text' },
    ...STATS.map((stat): FieldSpec => ({ id: stat, label: stat, kind: 'number', initial: 1 })),
  ],
  tracks: [
    { id: 'health', label: 'Health', segments: 5, startsFilled: 5 },
    { id: 'spirit', label: 'Spirit', segments: 5, startsFilled: 5 },
    { id: 'supply', label: 'Supply', segments: 5, startsFilled: 5 },
  ],
};

/** A vow: a rank in words, and ten segments of progress starting empty. */
export const VOW_TEMPLATE: EntityTemplate = {
  typeId: `sys.${STARFORGED_SYSTEM_ID}.vow`,
  name: 'Vow',
  fields: [
    { id: 'name', label: 'Name', kind: 'text' },
    // The lowest rank, as an opinion a player changes, not a rule. A vow
    // sworn without saying a rank still has one on its sheet to argue with.
    { id: 'rank', label: 'Rank', kind: 'text', initial: 'troublesome' },
  ],
  tracks: [{ id: 'progress', label: 'Progress', segments: 10, startsFilled: 0 }],
};

export const templates: readonly EntityTemplate[] = [CHARACTER_TEMPLATE, VOW_TEMPLATE];
