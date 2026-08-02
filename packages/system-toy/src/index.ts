/**
 * `@aether-forge/system-toy` — the canary module.
 *
 * A trivial coin-flip journaling system whose only job is to keep the module
 * contract honest: core's test suite runs every contract-consuming path against
 * both this module and `system-ironsworn`, permanently. A contract change that
 * the toy cannot implement trivially is a contract bug, not a toy bug.
 */

import { CORE_CONTRACT_VERSION, type SystemId } from '@aether-forge/core';

export const TOY_SYSTEM_ID: SystemId = 'toy-coinflip';

/** The contract version this module was written against. */
export const COMPATIBLE_CORE_CONTRACT_VERSION = CORE_CONTRACT_VERSION;

/** A coin is a two-sided die. The toy needs no module-owned event types. */
export const COIN = { sides: 2, count: 1 } as const;
