import {
  createMemoryEventLog,
  createTranslatingLog,
  openCampaign,
  ROLL_PERFORMED,
  SUGGESTION_OFFERED,
  suggestions,
  type EventEnvelope,
  type OpenCampaign,
  type Projection,
} from '@aether-forge/core';
import { FACE_DANGER, STARFORGED_SYSTEM_ID } from '@aether-forge/system-ironsworn';
import { CALL_IT, TOY_SYSTEM_ID } from '@aether-forge/system-toy';
import { describe, expect, it } from 'vitest';

import { declareEventTypes } from './event-types';
import { runCheck } from './run-check';

function openACampaign(): { campaign: OpenCampaign; read: () => readonly EventEnvelope[] } {
  let tick = 0;
  const log = createTranslatingLog(
    createMemoryEventLog({
      campaignId: 'campaign-under-test',
      now: () => `2026-08-07T09:00:00.${String(1000 + (tick += 1)).slice(1)}Z`,
      nextEventId: () => `event-${String(tick)}`,
    }),
    declareEventTypes(),
  );

  const opened = openCampaign(log, { projections: [suggestions as Projection<unknown>] });
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

/** Dice a person threw on their table and typed in. */
const THREW = [4, 2, 9];

function aFaceDangerRun(thrown?: readonly number[]) {
  const { campaign, read } = openACampaign();

  const ran = runCheck(campaign, {
    systemId: STARFORGED_SYSTEM_ID,
    checkId: FACE_DANGER.id,
    inputs: { stat: 2, bonus: 0 },
    ...(thrown === undefined ? {} : { thrown }),
  });

  if (!ran.ok) throw new Error(`the check did not run: ${ran.failure.detail}`);
  return { view: ran.value, campaign, events: read() };
}

describe('running a check end to end', () => {
  it('writes the invocation, the roll, the resolution and the offer', () => {
    const { events } = aFaceDangerRun(THREW);

    expect(events.map((event) => event.type)).toEqual([
      'sys.ironsworn-starforged.move.invoked',
      ROLL_PERFORMED,
      'sys.ironsworn-starforged.move.resolved',
      SUGGESTION_OFFERED,
    ]);
  });

  it('joins each event to the one that caused it', () => {
    // Core gives causation by position, because none of the drafts has an
    // identifier until it is written. This is where positions become
    // identifiers, and nothing else can do it.
    const { events } = aFaceDangerRun(THREW);

    expect(events[0]?.causationId).toBeUndefined();
    expect(events[1]?.causationId).toBe(events[0]?.id);
    expect(events[2]?.causationId).toBe(events[1]?.id);
    expect(events[3]?.causationId).toBe(events[2]?.id);
  });

  it('answers with what the module said the dice meant', () => {
    // 4 with a stat of 2 makes 6, which beats one of 2 and 9 and not the other.
    // Asserted as the value it actually is, because an assertion that the label
    // is merely non-empty would pass for any outcome at all.
    const { view } = aFaceDangerRun(THREW);

    expect(view.outcome.id).toBe('weak-hit');
    expect(view.outcome.label).toBe('Weak hit');
    expect(view.name).toBe(FACE_DANGER.name);
  });

  it('says the same thing the resolution written into the log says', () => {
    // The outcome is worked out once and recorded. If these two disagreed, the
    // card and the campaign would tell different stories about the same roll.
    const { view, events } = aFaceDangerRun(THREW);
    const resolved = events.find((event) => event.type.endsWith('.resolved'));

    expect((resolved?.payload as { outcome: string }).outcome).toBe(view.outcome.id);
  });

  it('leaves the offer unanswered, which is the point of the two acts', () => {
    const { campaign, view } = aFaceDangerRun(THREW);

    expect(view.offers).toHaveLength(1);
    expect(campaign.stateOf(suggestions).offers.map((offer) => offer.fate)).toEqual(['offered']);
  });

  it('names the offer by the event that made it, so it can be answered later', () => {
    const { campaign, view } = aFaceDangerRun(THREW);
    const inTheLog = campaign.stateOf(suggestions).offers[0];

    expect(view.offers[0]?.id).toBe(inTheLog?.id);
  });

  it('carries what may be changed about the offer', () => {
    const { view } = aFaceDangerRun(THREW);

    expect(view.offers[0]?.fields.length).toBeGreaterThan(0);
  });
});

describe('dice somebody threw, and dice the application rolled', () => {
  it('produces the same events apart from where each die came from', () => {
    // The gate. Manual entry is not a way in for tests: it is the route a
    // person with dice on the table uses, and everything downstream has to be
    // identical either way.
    const byHand = aFaceDangerRun(THREW);
    const byTheApplication = aFaceDangerRun();

    expect(byTheApplication.events.map((event) => event.type)).toEqual(
      byHand.events.map((event) => event.type),
    );

    const sourcesOf = (run: typeof byHand) =>
      run.events
        .filter((event) => event.type === ROLL_PERFORMED)
        .flatMap((event) => (event.payload as { dice: { source: { kind: string } }[] }).dice)
        .map((die) => die.source.kind);

    expect(sourcesOf(byHand)).toEqual(['manual', 'manual', 'manual']);
    expect(sourcesOf(byTheApplication)).toEqual(['digital', 'digital', 'digital']);
  });

  it('records exactly the numbers a person typed in', () => {
    const { view } = aFaceDangerRun(THREW);

    expect(view.dice.map((die) => die.value)).toEqual(THREW);
    expect(view.dice.every((die) => die.from === 'manual')).toBe(true);
  });

  it('rolls within range every time when nobody hands anything in', () => {
    // Randomness lives in the main process. This is the one thing about it that
    // can be asserted without pinning the numbers, so it is asserted often.
    for (let attempt = 0; attempt < 50; attempt += 1) {
      for (const die of aFaceDangerRun().view.dice) {
        expect(die.value).toBeGreaterThanOrEqual(1);
        expect(die.value).toBeLessThanOrEqual(die.sides);
      }
    }
  });

  it('keeps the label the check asked each die under', () => {
    const { view } = aFaceDangerRun(THREW);

    expect(view.dice.map((die) => die.label)).toEqual(['action', 'challenge', 'challenge']);
  });
});

describe('the toy, which is the canary', () => {
  it('runs a check the same way, with one die and nothing proposed', () => {
    // If a coin flip cannot run through this path, the path is shaped around one
    // system and it is the path that is wrong.
    const { campaign, read } = openACampaign();

    const ran = runCheck(campaign, {
      systemId: TOY_SYSTEM_ID,
      checkId: CALL_IT.id,
      inputs: {},
      thrown: [1],
    });

    if (!ran.ok) throw new Error(`the toy check did not run: ${ran.failure.detail}`);

    expect(read().map((event) => event.type)).toEqual([
      'sys.toy-coinflip.check.invoked',
      ROLL_PERFORMED,
      'sys.toy-coinflip.check.resolved',
    ]);
    expect(ran.value.offers).toEqual([]);
    expect(ran.value.outcome.label).toBe('Heads');
  });
});

describe('what it refuses, and what it does not', () => {
  it('refuses a die showing a number it does not have', () => {
    // The only thing ever refused about a roll. A ten-sided die cannot show 12,
    // and recording it would put a number in the log nothing can explain.
    const { campaign, read } = openACampaign();

    const ran = runCheck(campaign, {
      systemId: STARFORGED_SYSTEM_ID,
      checkId: FACE_DANGER.id,
      inputs: { stat: 2, bonus: 0 },
      thrown: [4, 12, 9],
    });

    expect(ran.ok).toBe(false);
    expect(!ran.ok && ran.failure.detail).toContain('cannot show 12');
    // Nothing was written. A refused roll is not half a check.
    expect(read()).toEqual([]);
  });

  it('refuses the wrong number of dice, and says how many it wanted', () => {
    const { campaign } = openACampaign();

    const ran = runCheck(campaign, {
      systemId: STARFORGED_SYSTEM_ID,
      checkId: FACE_DANGER.id,
      inputs: { stat: 2, bonus: 0 },
      thrown: [4],
    });

    expect(!ran.ok && ran.failure.kind).toBe('wrong-number-of-dice');
    expect(!ran.ok && ran.failure.detail).toContain('3 dice');
  });

  it('refuses a check no loaded system declares', () => {
    const { campaign } = openACampaign();

    const ran = runCheck(campaign, {
      systemId: STARFORGED_SYSTEM_ID,
      checkId: 'nothing/at-all',
      inputs: {},
    });

    expect(!ran.ok && ran.failure.kind).toBe('unknown-check');
  });

  it.each([
    ['nothing at all', undefined],
    ['not an object', 7],
    ['no check named', { systemId: STARFORGED_SYSTEM_ID, inputs: {} }],
    ['inputs that are not numbers', { systemId: 'a', checkId: 'b', inputs: { stat: 'two' } }],
    ['dice that are not numbers', { systemId: 'a', checkId: 'b', inputs: {}, thrown: ['4'] }],
  ])('refuses a request that is %s', (_name, request) => {
    // Whatever crossed the boundary is whatever another process chose to send.
    const { campaign } = openACampaign();
    const ran = runCheck(campaign, request);

    expect(!ran.ok && ran.failure.kind).toBe('invalid-request');
  });

  it('takes a number a rule would forbid, without comment', () => {
    // The application computes and does not decide. A stat of ninety is not
    // this surface's business, and there is no channel here to refuse it.
    const { campaign } = openACampaign();

    const ran = runCheck(campaign, {
      systemId: STARFORGED_SYSTEM_ID,
      checkId: FACE_DANGER.id,
      inputs: { stat: 90, bonus: 0 },
      thrown: THREW,
    });

    expect(ran.ok).toBe(true);
  });
});
