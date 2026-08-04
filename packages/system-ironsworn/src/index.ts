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
  type EventTypeDefinition,
  type ModuleProjection,
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
export const eventTypes: readonly EventTypeDefinition[] = [
  { type: MOMENTUM_CHANGED, currentVersion: 1, translations: [] },
];
