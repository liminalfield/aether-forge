import type { CheckDefinition, SystemId } from '@aether-forge/core';
import { checks as ironswornChecks, STARFORGED_SYSTEM_ID } from '@aether-forge/system-ironsworn';
import { checks as toyChecks, TOY_SYSTEM_ID } from '@aether-forge/system-toy';

/**
 * The system modules this build loads.
 *
 * One list, so that anything needing to reach a module goes through the same
 * place rather than importing whichever one it happens to want. A module
 * reached directly from three files is a module that gets forgotten in the
 * fourth.
 *
 * The toy is loaded alongside the real system deliberately and permanently. It
 * is the canary: every path that consumes the module contract runs against both,
 * and a contract change the toy cannot implement trivially is a contract that is
 * wrong.
 */
export interface LoadedSystem {
  readonly systemId: SystemId;
  readonly checks: readonly CheckDefinition[];
}

export const LOADED_SYSTEMS: readonly LoadedSystem[] = [
  { systemId: TOY_SYSTEM_ID, checks: toyChecks },
  { systemId: STARFORGED_SYSTEM_ID, checks: ironswornChecks },
];
