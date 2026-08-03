import { describe, expect, it } from 'vitest';

import {
  isCoreEvent,
  isModuleEvent,
  type CoreEvent,
  type EventEnvelope,
  type EventType,
  type ModuleEvent,
} from './event.js';
import type { SystemId } from './identifiers.js';

/**
 * Resolves to `true` when `From` is assignable to `To`.
 *
 * Used below to assert that certain shapes are *rejected*. These are checked by
 * the compiler, not at runtime: if one of the constraints is ever lost, the
 * build fails on the assignment rather than the mistake surfacing as a
 * malformed event much later.
 */
type Assignable<From, To> = From extends To ? true : false;

const anEntryWasRevised: CoreEvent<{ entryId: string; text: string }> = {
  id: '01K9QF3W7ZR8XN2VC4MTBD6H1A',
  campaignId: '01K9QF0000000000000000000',
  seq: 12,
  at: '2026-08-03T09:12:44.108Z',
  type: 'core.entry.revised',
  schemaVersion: 1,
  revises: '01K9QF2222222222222222222',
  payload: { entryId: '01K9QF1111111111111111111', text: 'The airlock did not open.' },
};

const aCoinWasFlipped: ModuleEvent<{ result: 'heads' | 'tails' }> = {
  id: '01K9QF4444444444444444444',
  campaignId: '01K9QF0000000000000000000',
  seq: 13,
  at: '2026-08-03T09:13:02.551Z',
  type: 'sys.toy-coinflip.coin.flipped',
  schemaVersion: 1,
  systemId: 'toy-coinflip',
  causationId: '01K9QF3W7ZR8XN2VC4MTBD6H1A',
  payload: { result: 'heads' },
};

describe('the shape of a recorded event', () => {
  it('carries a core event and its data', () => {
    expect(anEntryWasRevised.seq).toBe(12);
    expect(anEntryWasRevised.payload.text).toBe('The airlock did not open.');
  });

  it('carries a module event, tagged with the module that owns it', () => {
    expect(aCoinWasFlipped.systemId).toBe('toy-coinflip');
    expect(aCoinWasFlipped.payload.result).toBe('heads');
  });

  it('records what caused an event, pointing backwards', () => {
    expect(aCoinWasFlipped.causationId).toBe(anEntryWasRevised.id);
  });

  it('records what an event supersedes', () => {
    expect(anEntryWasRevised.revises).toBe('01K9QF2222222222222222222');
  });

  it('leaves cause and correction off an event that has neither', () => {
    const plain: CoreEvent<Record<string, never>> = {
      id: '01K9QF5555555555555555555',
      campaignId: '01K9QF0000000000000000000',
      seq: 1,
      at: '2026-08-03T09:00:00.000Z',
      type: 'core.campaign.created',
      schemaVersion: 1,
      payload: {},
    };

    expect('causationId' in plain).toBe(false);
    expect('revises' in plain).toBe(false);
  });
});

describe('telling core events from module events', () => {
  const log: EventEnvelope[] = [anEntryWasRevised, aCoinWasFlipped];

  it('recognises a module event and narrows it', () => {
    const found = log.filter(isModuleEvent);
    expect(found).toHaveLength(1);
    // Reachable only because the guard narrowed the type.
    expect(found[0]?.systemId).toBe('toy-coinflip');
  });

  it('recognises a core event', () => {
    const found = log.filter(isCoreEvent);
    expect(found).toHaveLength(1);
    expect(found[0]?.type).toBe('core.entry.revised');
  });

  it('treats the two as exhaustive', () => {
    for (const event of log) {
      expect(isCoreEvent(event)).toBe(!isModuleEvent(event));
    }
  });
});

describe('shapes the compiler refuses', () => {
  it('will not let a core event carry a system id', () => {
    type CoreEventCarryingSystemId = Omit<CoreEvent, 'systemId'> & { readonly systemId: SystemId };
    const rejected: Assignable<CoreEventCarryingSystemId, CoreEvent> = false;
    expect(rejected).toBe(false);
  });

  it('will not let a module event omit its system id', () => {
    type ModuleEventMissingSystemId = Omit<ModuleEvent, 'systemId'>;
    const rejected: Assignable<ModuleEventMissingSystemId, ModuleEvent> = false;
    expect(rejected).toBe(false);
  });

  it('will not accept an event type outside the core and module namespaces', () => {
    const rejected: Assignable<'entry.revised', EventType> = false;
    const acceptedCore: Assignable<'core.entry.revised', EventType> = true;
    const acceptedModule: Assignable<'sys.toy-coinflip.coin.flipped', EventType> = true;

    expect([rejected, acceptedCore, acceptedModule]).toEqual([false, true, true]);
  });
});
