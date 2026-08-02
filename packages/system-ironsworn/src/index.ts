/**
 * `@aether-forge/system-ironsworn` — the Ironsworn and Ironsworn: Starforged
 * system module.
 *
 * This is where rulebook vocabulary is allowed to live. Content arrives as
 * neutral ContentPackages produced by `@aether-forge/importer-datasworn`; this
 * module never sees Datasworn types.
 */

import { CORE_CONTRACT_VERSION, type SystemId } from '@aether-forge/core';

export const STARFORGED_SYSTEM_ID: SystemId = 'ironsworn-starforged';
export const IRONSWORN_SYSTEM_ID: SystemId = 'ironsworn-classic';

/** The contract version this module was written against. */
export const COMPATIBLE_CORE_CONTRACT_VERSION = CORE_CONTRACT_VERSION;
