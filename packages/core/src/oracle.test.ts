import { describe, expect, it } from 'vitest';

import { openCampaign } from './campaign.js';
import { createMemoryEventLog } from './memory-log.js';
import {
  ORACLE_CONSULTED,
  oracleEventTypes,
  readOracleConsultation,
  type OracleConsultedV1,
} from './oracle.js';
import { ROLL_PERFORMED, rollEventTypes, type RollPerformedV1 } from './roll.js';
import { createEventSchemas } from './schema.js';
import { describeSchemaTranslations } from './testing/schema-contract.js';
import { createTranslatingLog, type TranslatingLog } from './translating-log.js';

function aLog(): TranslatingLog {
  let tick = 0;
  const schemas = createEventSchemas();
  for (const definition of [...oracleEventTypes, ...rollEventTypes]) schemas.declare(definition);

  return createTranslatingLog(
    createMemoryEventLog({
      campaignId: 'campaign-under-test',
      now: () => `2026-08-05T09:00:0${(tick += 1)}.000Z`,
      nextEventId: () => `event-${tick}`,
    }),
    schemas,
  );
}

function openWith(log: TranslatingLog) {
  const opened = openCampaign(log, { projections: [] });
  if (!opened.ok) throw new Error(`could not open: ${opened.failure.kind}`);
  return opened.value;
}

/** Obviously-dummy content. Nothing here comes from a published table. */
const A_CONSULTATION: OracleConsultedV1 = {
  table: 'example.dummy-tables/weather',
  package: { id: 'example.dummy-tables', version: '1.2.0' },
  row: { from: 41, to: 60, text: 'Fog, and it is getting worse.' },
};

function aHundredSidedDie(value: number, source: 'digital' | 'manual'): RollPerformedV1 {
  return {
    request: { dice: [{ sides: 100, count: 1 }] },
    dice: [{ sides: 100, value, source: { kind: source } }],
  };
}

describe('a consultation is its own event', () => {
  it('survives being written and read back', () => {
    const campaign = openWith(aLog());
    const written = campaign.append({ type: ORACLE_CONSULTED, payload: A_CONSULTATION });
    if (!written.ok) throw new Error('could not write the consultation');

    expect(readOracleConsultation(written.value.payload)).toEqual(A_CONSULTATION);
  });

  it('points back at the roll that fed it', () => {
    const log = aLog();
    const campaign = openWith(log);

    const rolled = campaign.append({
      type: ROLL_PERFORMED,
      payload: aHundredSidedDie(47, 'manual'),
    });
    if (!rolled.ok) throw new Error('could not write the roll');

    const consulted = campaign.append({
      type: ORACLE_CONSULTED,
      causationId: rolled.value.id,
      payload: A_CONSULTATION,
    });
    if (!consulted.ok) throw new Error('could not write the consultation');

    // Two events, in order, the second caused by the first. The roll is a
    // number and the meaning is separate, which is the seam the whole design
    // rests on.
    const events = log.read();
    if (!events.ok) throw new Error('could not read the log');
    expect(events.value.map((event) => event.type)).toEqual([ROLL_PERFORMED, ORACLE_CONSULTED]);
    expect(events.value[1]?.causationId).toBe(rolled.value.id);
  });

  it('carries no dice of its own', () => {
    // If a consultation held the number, there would be two records of one
    // fact, and they would eventually disagree.
    expect(Object.keys(A_CONSULTATION).sort()).toEqual(['package', 'row', 'table']);
  });
});

describe('typed in by hand and rolled by the application are the same afterwards', () => {
  it('produces an identical consultation either way', () => {
    function consult(source: 'digital' | 'manual'): unknown {
      const campaign = openWith(aLog());
      const rolled = campaign.append({
        type: ROLL_PERFORMED,
        payload: aHundredSidedDie(47, source),
      });
      if (!rolled.ok) throw new Error('could not write the roll');

      const consulted = campaign.append({
        type: ORACLE_CONSULTED,
        causationId: rolled.value.id,
        payload: A_CONSULTATION,
      });
      if (!consulted.ok) throw new Error('could not write the consultation');

      return consulted.value.payload;
    }

    // The whole reason rolling and interpreting are separate acts. By the time
    // anything is resolved, a number is a number.
    expect(readOracleConsultation(consult('manual'))).toEqual(
      readOracleConsultation(consult('digital')),
    );
  });

  it('keeps where the die came from on the roll, where it belongs', () => {
    const log = aLog();
    const campaign = openWith(log);
    const rolled = campaign.append({
      type: ROLL_PERFORMED,
      payload: aHundredSidedDie(47, 'manual'),
    });
    if (!rolled.ok) throw new Error('could not write the roll');

    campaign.append({
      type: ORACLE_CONSULTED,
      causationId: rolled.value.id,
      payload: A_CONSULTATION,
    });

    const events = log.read();
    if (!events.ok) throw new Error('could not read the log');
    expect(JSON.stringify(events.value[1]?.payload)).not.toContain('manual');
  });
});

describe('a consultation still explains itself when the package changes', () => {
  it('says which version answered, and which row', () => {
    const campaign = openWith(aLog());

    const before = campaign.append({ type: ORACLE_CONSULTED, payload: A_CONSULTATION });
    if (!before.ok) throw new Error('could not write');

    // The same table, rewritten by a later version of the package: the range
    // moved and so did the words.
    const after = campaign.append({
      type: ORACLE_CONSULTED,
      payload: {
        table: 'example.dummy-tables/weather',
        package: { id: 'example.dummy-tables', version: '2.0.0' },
        row: { from: 41, to: 55, text: 'Fog, thinning.' },
      },
    });
    if (!after.ok) throw new Error('could not write');

    const first = readOracleConsultation(before.value.payload);
    const second = readOracleConsultation(after.value.payload);

    // Both still readable, and each still says what it meant at the time.
    expect(first?.package.version).toBe('1.2.0');
    expect(first?.row).toEqual({ from: 41, to: 60, text: 'Fog, and it is getting worse.' });
    expect(second?.package.version).toBe('2.0.0');
    expect(second?.row).toEqual({ from: 41, to: 55, text: 'Fog, thinning.' });
  });
});

describe('reading a payload that is not a consultation', () => {
  it.each([
    ['not an object', 7],
    ['no table', { package: { id: 'a', version: '1.0.0' }, row: { from: 1, to: 2, text: 'x' } }],
    ['no package', { table: 'a/b', row: { from: 1, to: 2, text: 'x' } }],
    ['no row', { table: 'a/b', package: { id: 'a', version: '1.0.0' } }],
    [
      'a package with no version',
      { table: 'a/b', package: { id: 'a' }, row: { from: 1, to: 2, text: 'x' } },
    ],
    [
      'a row with no range',
      { table: 'a/b', package: { id: 'a', version: '1.0.0' }, row: { text: 'x' } },
    ],
    [
      'a range that is not numbers',
      {
        table: 'a/b',
        package: { id: 'a', version: '1.0.0' },
        row: { from: '1', to: '2', text: 'x' },
      },
    ],
  ])('says no to %s', (_name, payload) => {
    expect(readOracleConsultation(payload)).toBeUndefined();
  });
});

describeSchemaTranslations(
  'core oracle events',
  () => {
    const schemas = createEventSchemas();
    for (const definition of oracleEventTypes) schemas.declare(definition);
    return schemas;
  },
  [{ type: ORACLE_CONSULTED, payloadsByVersion: { 1: A_CONSULTATION } }],
);
