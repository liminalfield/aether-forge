import type {
  CheckDefinition,
  EntityTemplate,
  ModuleEventType,
  SystemId,
} from '@aether-forge/core';
import {
  checks as ironswornChecks,
  MOVE_INVOKED,
  MOVE_RESOLVED,
  STARFORGED_SYSTEM_ID,
  templates as ironswornTemplates,
} from '@aether-forge/system-ironsworn';
import {
  CHECK_INVOKED,
  CHECK_RESOLVED,
  checks as toyChecks,
  templates as toyTemplates,
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
  /** The entities this system describes. Empty is a module that works. */
  readonly templates: readonly EntityTemplate[];
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
  /**
   * Whether this system is one somebody plays.
   *
   * The toy is loaded so that every path consuming the module contract runs
   * against two systems, which is the only thing keeping the contract honest.
   * It is not a game, and offering its coin flip in the window beside a real
   * check would be showing somebody a test fixture.
   *
   * Loading and offering are different questions, and this is where they part.
   */
  readonly playable: boolean;
}

/** The systems a person can actually roll a check from. */
export function playableSystems(): readonly LoadedSystem[] {
  return LOADED_SYSTEMS.filter((system) => system.playable);
}

export const LOADED_SYSTEMS: readonly LoadedSystem[] = [
  {
    systemId: TOY_SYSTEM_ID,
    checks: toyChecks,
    templates: toyTemplates,
    checkEvents: { invoked: CHECK_INVOKED, resolved: CHECK_RESOLVED },
    playable: false,
  },
  {
    systemId: STARFORGED_SYSTEM_ID,
    checks: ironswornChecks,
    templates: ironswornTemplates,
    checkEvents: { invoked: MOVE_INVOKED, resolved: MOVE_RESOLVED },
    playable: true,
  },
];
