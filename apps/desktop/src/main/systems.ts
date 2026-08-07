import type { CheckDefinition, ModuleEventType, SystemId } from '@aether-forge/core';
import {
  checks as ironswornChecks,
  MOVE_INVOKED,
  MOVE_RESOLVED,
  STARFORGED_SYSTEM_ID,
} from '@aether-forge/system-ironsworn';
import {
  CHECK_INVOKED,
  CHECK_RESOLVED,
  checks as toyChecks,
  TOY_SYSTEM_ID,
} from '@aether-forge/system-toy';

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
  /**
   * The two events this system writes either side of a check's roll.
   *
   * Named by the module rather than worked out from the system's identifier.
   * Guessing an event type from a string is how a build ends up writing events
   * nothing has declared, and the log would take them.
   */
  readonly checkEvents: {
    readonly invoked: ModuleEventType;
    readonly resolved: ModuleEventType;
  };
}

export const LOADED_SYSTEMS: readonly LoadedSystem[] = [
  {
    systemId: TOY_SYSTEM_ID,
    checks: toyChecks,
    checkEvents: { invoked: CHECK_INVOKED, resolved: CHECK_RESOLVED },
  },
  {
    systemId: STARFORGED_SYSTEM_ID,
    checks: ironswornChecks,
    checkEvents: { invoked: MOVE_INVOKED, resolved: MOVE_RESOLVED },
  },
];
