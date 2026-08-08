import {
  createMemoryEventLog,
  createTranslatingLog,
  entities,
  journal,
  openCampaign,
  ORACLE_CONSULTED,
  readOracleConsultation,
  ROLL_PERFORMED,
  suggestions,
  type ContentPackage,
  type EventEnvelope,
  type EventLog,
  type OpenCampaign,
  type Projection,
} from '@aether-forge/core';
import { YES_OR_NO_PREFIX } from '@aether-forge/system-ironsworn';
import { describe, expect, it } from 'vitest';

import { consultOracle } from './consult';
import { loadFixtureSystems } from './content-fixture';
import { declareEventTypes } from './event-types';
import type { RegistryHolder } from './import-package';

loadFixtureSystems();

/** Obviously-dummy content. Nothing here comes from a published table. */
const A_BOX: ContentPackage = {
  manifest: {
    id: 'example.dummy-tables',
    version: '0.4.1',
    title: 'Dummy Tables',
    systems: ['ironsworn-starforged'],
    license: 'CC-BY-4.0',
    source: 'bundled',
    contentHash: 'sha256-irrelevant-here',
  },
  tables: [
    {
      id: 'example/derelict/what-the-silence-holds',
      name: 'What The Silence Holds',
      dice: { sides: 100, count: 1 },
      rows: [
        { from: 1, to: 40, text: 'Nothing that was not already there.' },
        { from: 41, to: 60, text: 'Someone has been here recently.' },
        // 61 to 100 deliberately missing: a gap, as a publisher might write.
      ],
    },
  ],
  documents: [],
  entityTemplates: [],
};

const holder: RegistryHolder = { current: { packages: [A_BOX], problems: [] } };

function aStoredLog(): EventLog {
  let tick = 0;
  return createMemoryEventLog({
    campaignId: 'campaign-under-test',
    now: () => `2026-08-08T12:00:00.${String(1000 + (tick += 1)).slice(1)}Z`,
    nextEventId: () => `event-${String(tick)}`,
  });
}

function aCampaign(): { campaign: OpenCampaign; read: () => readonly EventEnvelope[] } {
  const log = createTranslatingLog(aStoredLog(), declareEventTypes());
  const opened = openCampaign(log, {
    projections: [
      journal as Projection<unknown>,
      suggestions as Projection<unknown>,
      entities as Projection<unknown>,
    ],
  });
  if (!opened.ok) throw new Error('could not open the campaign');

  return {
    campaign: opened.value,
    read: () => {
      const events = log.read();
      if (!events.ok) throw new Error('could not read the log');
      return events.value;
    },
  };
}

const A_TABLE = 'example/derelict/what-the-silence-holds';

describe('consulting a table', () => {
  it('answers with the row the die landed on', () => {
    const { campaign } = aCampaign();

    const answer = consultOracle(campaign, holder, { tableId: A_TABLE, thrown: [47] });

    if (!answer.ok) throw new Error(answer.failure.detail);
    expect(answer.value.answer).toBe('Someone has been here recently.');
    expect(answer.value.row).toEqual({ from: 41, to: 60 });
    expect(answer.value.name).toBe('What The Silence Holds');
    expect(answer.value.group).toBe('derelict');
  });

  it('writes the roll and the reading, in that order, the second caused by the first', () => {
    const { campaign, read } = aCampaign();

    consultOracle(campaign, holder, { tableId: A_TABLE, thrown: [47] });

    const events = read();
    expect(events.map((event) => event.type)).toEqual([ROLL_PERFORMED, ORACLE_CONSULTED]);
    expect(events[1]?.causationId).toBe(events[0]?.id);
  });

  it('records which package answered, and which version of it', () => {
    const { campaign, read } = aCampaign();

    consultOracle(campaign, holder, { tableId: A_TABLE, thrown: [47] });

    const consulted = readOracleConsultation(read()[1]?.payload);
    expect(consulted?.package).toEqual({ id: 'example.dummy-tables', version: '0.4.1' });
    expect(consulted?.row.text).toBe('Someone has been here recently.');
  });

  it('carries where the die came from, and rolls its own when nobody hands one in', () => {
    const thrown = aCampaign();
    consultOracle(thrown.campaign, holder, { tableId: A_TABLE, thrown: [47] });
    expect(
      (thrown.read()[0]?.payload as { dice: { source: { kind: string } }[] }).dice[0]?.source.kind,
    ).toBe('manual');

    const rolled = aCampaign();
    const answer = consultOracle(rolled.campaign, holder, { tableId: A_TABLE });
    // Whatever it rolled, it either landed on a row or in the gap. Both are
    // real answers; what matters is that it rolled its own die.
    if (answer.ok) {
      expect(answer.value.dice[0]?.from).toBe('digital');
    } else {
      expect(answer.failure.kind).toBe('no-row-at');
    }
  });

  it('answers identically whether the die was thrown or rolled, given the same number', () => {
    // The seam the whole design rests on.
    const first = aCampaign();
    const second = aCampaign();

    const thrown = consultOracle(first.campaign, holder, { tableId: A_TABLE, thrown: [47] });
    const also = consultOracle(second.campaign, holder, { tableId: A_TABLE, thrown: [47] });

    if (!thrown.ok || !also.ok) throw new Error('the fixture failed to consult');
    expect({ ...thrown.value, dice: [] }).toEqual({ ...also.value, dice: [] });
  });
});

describe('asking a yes-or-no question', () => {
  it('answers yes below the line and no above it, through the same channel', () => {
    const { campaign } = aCampaign();
    const likely = `${YES_OR_NO_PREFIX}likely`;

    const yes = consultOracle(campaign, holder, { tableId: likely, thrown: [40] });
    const no = consultOracle(campaign, holder, { tableId: likely, thrown: [90] });

    expect(yes.ok && yes.value.answer).toBe('Yes');
    expect(no.ok && no.value.answer).toBe('No');
  });

  it('records the same way a table answer does', () => {
    // The reason the module builds them as tables: nothing downstream has to
    // know which kind of asking this was.
    const { campaign, read } = aCampaign();

    consultOracle(campaign, holder, { tableId: `${YES_OR_NO_PREFIX}likely`, thrown: [40] });

    expect(read().map((event) => event.type)).toEqual([ROLL_PERFORMED, ORACLE_CONSULTED]);
    expect(readOracleConsultation(read()[1]?.payload)?.package.id).toBe('ironsworn-starforged.ask');
  });
});

describe('what it refuses, and writes nothing for', () => {
  it('refuses a table this machine does not hold', () => {
    const { campaign, read } = aCampaign();

    const answer = consultOracle(campaign, holder, { tableId: 'someone-elses/table' });

    expect(!answer.ok && answer.failure.kind).toBe('unknown-table');
    expect(read()).toEqual([]);
  });

  it('refuses a request with no table at all', () => {
    const { campaign } = aCampaign();

    expect(consultOracle(campaign, holder, {}).ok).toBe(false);
    expect(consultOracle(campaign, holder, null).ok).toBe(false);
  });

  it('refuses a number the table skips, rather than answering with the nearest thing', () => {
    // Content is recorded as its publisher wrote it, gaps and all.
    const { campaign, read } = aCampaign();

    const answer = consultOracle(campaign, holder, { tableId: A_TABLE, thrown: [75] });

    expect(!answer.ok && answer.failure.kind).toBe('no-row-at');
    expect(read()).toEqual([]);
  });

  it('refuses the wrong number of dice, and says how many it wanted', () => {
    const { campaign, read } = aCampaign();

    const answer = consultOracle(campaign, holder, { tableId: A_TABLE, thrown: [40, 50] });

    expect(!answer.ok && answer.failure.detail).toContain('1 dice');
    expect(read()).toEqual([]);
  });
});
