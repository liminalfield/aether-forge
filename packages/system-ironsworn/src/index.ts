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
  type EntityTemplate,
  type EventTypeDefinition,
  type FieldSpec,
  type ModuleProjection,
} from '@aether-forge/core';

export { IRONSWORN_SYSTEM_ID, STARFORGED_SYSTEM_ID } from './ids.js';
import { MOMENTUM_CHANGED, MOVE_INVOKED, MOVE_RESOLVED, STARFORGED_SYSTEM_ID } from './ids.js';
export { MOMENTUM_CHANGED, MOVE_INVOKED, MOVE_RESOLVED } from './ids.js';

/** The contract version this module was written against. */
export const COMPATIBLE_CORE_CONTRACT_VERSION = CORE_CONTRACT_VERSION;

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
 * The checks this module offers come from installed content joined to its
 * interpreters; see `checks-from-content.ts`. The hand-written Face Danger
 * declaration that stood here retired when the whole move list arrived,
 * 8 August 2026 (#167). Its behaviour lives on in the action-roll
 * interpreter and the tuned momentum proposals, held to parity by tests.
 */
export { checksFrom } from './checks-from-content.js';

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

export {
  ACTION_ROLL_OUTCOMES,
  interpretActionRoll,
  interpretNoRoll,
  interpretProgressRoll,
  NO_ROLL_OUTCOMES,
  PROGRESS_ROLL_OUTCOMES,
  type SuggestsFor,
} from './interpreters.js';
