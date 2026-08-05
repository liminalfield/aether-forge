import { describe, expect, it } from 'vitest';

import * as core from './index.js';
import type {
  CampaignViews,
  DieSource,
  DieSpec,
  DieValue,
  EventEnvelope,
  EventLog,
  ModuleProjection,
  OracleConsultedV1,
  OracleRow,
  OpenCampaign,
  PackageStamp,
  Projection,
  Result,
  RecordedRoll,
  RollContext,
  RollFailure,
  RollPerformedV1,
  RollReplacement,
  RollRequest,
  Rolls,
  RollSupersession,
  TranslatingLog,
} from './index.js';

describe('@aether-forge/core', () => {
  it('declares a contract version', () => {
    expect(core.CORE_CONTRACT_VERSION).toBe(1);
  });

  it('versions anything that crosses the log boundary', () => {
    const payload: core.Versioned = { schemaVersion: 1 };
    expect(payload.schemaVersion).toBeGreaterThan(0);
  });
});

/**
 * Core's own tests import by relative path, so a module missing from index.ts
 * still passes every one of them and simply cannot be reached from another
 * package. That happened: projections and campaigns were written, tested, and
 * merged without ever being exported.
 *
 * These check the surface itself. The values are checked at run time and the
 * types at compile time, because a missing type export is just as broken and
 * would not show up in Object.keys.
 */
describe('the public surface', () => {
  it('exposes everything another package needs to use a log', () => {
    expect(Object.keys(core)).toEqual(
      expect.arrayContaining([
        'CORE_CONTRACT_VERSION',
        'ok',
        'failed',
        'isCoreEvent',
        'isModuleEvent',
        'isModuleEventDraft',
        'createMemoryEventLog',
        'createEventSchemas',
        'createTranslatingLog',
        'describeFailure',
        'replay',
        'buildFromLog',
        'isVisibleToModule',
        'openCampaign',
        'ROLL_PERFORMED',
        'rollEventTypes',
        'readRoll',
        'validateRoll',
        'rolls',
        'ORACLE_CONSULTED',
        'oracleEventTypes',
        'readOracleConsultation',
      ]),
    );
  });

  it('exposes the types those values are useless without', () => {
    // Never executed. Naming each type here is what makes a missing type
    // export a build failure rather than a surprise in another package.
    const surface = (
      _event: EventEnvelope,
      _log: EventLog,
      _translating: TranslatingLog,
      _projection: Projection<number>,
      _moduleProjection: ModuleProjection<number>,
      _views: CampaignViews,
      _campaign: OpenCampaign,
      _result: Result<number, string>,
      _spec: DieSpec,
      _source: DieSource,
      _die: DieValue,
      _request: RollRequest,
      _roll: RollPerformedV1,
      _rollFailure: RollFailure,
      _rollContext: RollContext,
      _supersession: RollSupersession,
      _recorded: RecordedRoll,
      _replacement: RollReplacement,
      _rolls: Rolls,
      _consultation: OracleConsultedV1,
      _row: OracleRow,
      _stamp: PackageStamp,
    ): void => undefined;

    expect(typeof surface).toBe('function');
  });
});
