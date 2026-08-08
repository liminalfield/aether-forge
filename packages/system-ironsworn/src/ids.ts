import type { SystemId } from '@aether-forge/core';

/** The identifiers shared across this module's files. */
export const STARFORGED_SYSTEM_ID: SystemId = 'ironsworn-starforged';
export const IRONSWORN_SYSTEM_ID: SystemId = 'ironsworn-classic';

/** Momentum moved. Carries the change, never the resulting value. */
export const MOMENTUM_CHANGED = 'sys.ironsworn-starforged.momentum.changed';

/** The two event types a check writes either side of its roll. */
export const MOVE_INVOKED = 'sys.ironsworn-starforged.move.invoked';
export const MOVE_RESOLVED = 'sys.ironsworn-starforged.move.resolved';
