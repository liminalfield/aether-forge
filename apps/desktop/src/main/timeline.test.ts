import {
  createMemoryEventLog,
  createTranslatingLog,
  declaresStyleFor,
  ENTRY_CREATED,
  openCampaign,
  journal,
  suggestions,
  type EventEnvelope,
  type EventLog,
  type OpenCampaign,
  type Projection,
} from '@aether-forge/core';
import { FACE_DANGER, STARFORGED_SYSTEM_ID } from '@aether-forge/system-ironsworn';
import { CALL_IT, TOY_SYSTEM_ID } from '@aether-forge/system-toy';
import { describe, expect, it } from 'vitest';

import { answerOffer } from './answer-offer';
import { declareEventTypes } from './event-types';
import { runCheck } from './run-check';
import { readTimeline } from './timeline';

function aStoredLog(): EventLog {
  let tick = 0;
  return createMemoryEventLog({
    campaignId: 'campaign-under-test',
    now: () => `2026-08-07T09:00:00.${String(1000 + (tick += 1)).slice(1)}Z`,
    nextEventId: () => `event-${String(tick)}`,
  });
}

function openOver(stored: EventLog): {
  campaign: OpenCampaign;
  events: () => readonly EventEnvelope[];
} {
  const log = createTranslatingLog(stored, declareEventTypes());
  const opened = openCampaign(log, {
    projections: [journal as Projection<unknown>, suggestions as Projection<unknown>],
  });

  if (!opened.ok) throw new Error('could not open the campaign');

  return {
    campaign: opened.value,
    events: () => {
      const read = log.read();
      if (!read.ok) throw new Error('could not read the log');
      return read.value;
    },
  };
}

const THREW = [4, 2, 9];

/** A session with prose either side of a check, which is what a session is. */
function aSession(stored: EventLog = aStoredLog()) {
  const { campaign, events } = openOver(stored);

  campaign.append({ type: ENTRY_CREATED, payload: { text: 'Something moved in the cargo bay.' } });

  const ran = runCheck(campaign, {
    systemId: STARFORGED_SYSTEM_ID,
    checkId: FACE_DANGER.id,
    inputs: { stat: 2, bonus: 0 },
    thrown: THREW,
  });

  if (!ran.ok) throw new Error(ran.failure.detail);

  campaign.append({ type: ENTRY_CREATED, payload: { text: 'I should not have called out.' } });

  return { campaign, stored, events, offerId: ran.value.offers[0]?.id ?? '' };
}

const timelineOf = (session: ReturnType<typeof aSession>) =>
  readTimeline(session.campaign, session.events()).items;

describe('the campaign as one thing', () => {
  it('holds prose and checks together, in the order they happened', () => {
    // A journal that held only the writing would make the rolls a separate
    // history of the same evening.
    expect(timelineOf(aSession()).map((item) => item.kind)).toEqual(['entry', 'check', 'entry']);
  });

  it('keeps the prose readable as prose', () => {
    const [first] = timelineOf(aSession());

    expect(first?.kind === 'entry' && first.entry.text).toBe('Something moved in the cargo bay.');
  });

  it('says when each thing happened', () => {
    for (const item of timelineOf(aSession())) {
      expect(item.at).not.toBe('');
    }
  });
});

describe('a check on the timeline', () => {
  const checkFrom = (session = aSession()) => {
    const item = timelineOf(session).find((each) => each.kind === 'check');
    if (item?.kind !== 'check') throw new Error('the timeline held no check');
    return item.check;
  };

  it('says what ran and what it came to', () => {
    const check = checkFrom();

    expect(check.name).toBe(FACE_DANGER.name);
    expect(check.outcome.id).toBe('weak-hit');
    expect(check.outcome.summary).not.toBe('');
  });

  it('carries every die, and where each one came from', () => {
    // The gate. Somebody reading their own log a year later should not have to
    // go looking for whether they threw those dice themselves.
    const check = checkFrom();

    expect(check.dice.map((die) => die.value)).toEqual(THREW);
    expect(check.dice.every((die) => die.from === 'manual')).toBe(true);
    expect(check.dice.map((die) => die.label)).toEqual(['action', 'challenge', 'challenge']);
  });

  it('carries what it ran with', () => {
    expect(checkFrom().inputs).toEqual({ stat: 2, bonus: 0 });
  });

  it('is drawn with a colour and a glyph the module declared', () => {
    // How it is drawn comes from the module as it stands today. What happened
    // was written down when it happened.
    const check = checkFrom();

    expect(check.outcome.label).toBe('Weak hit');
    expect(check.outcome.tone).toBe('weak');
    expect(check.outcome.glyph).not.toBe('');
  });
});

describe('an offer on the timeline', () => {
  const offersFrom = (session: ReturnType<typeof aSession>) => {
    const item = timelineOf(session).find((each) => each.kind === 'check');
    if (item?.kind !== 'check') throw new Error('the timeline held no check');
    return item.check.offers;
  };

  it('is there, unanswered, waiting', () => {
    const offers = offersFrom(aSession());

    expect(offers).toHaveLength(1);
    expect(offers[0]?.fate).toBe('offered');
    expect(offers[0]?.label).not.toBe('');
  });

  it('is still there after the application is closed and opened again', () => {
    // The whole reason an unanswered offer is a real state. Somebody
    // interrupted mid-decision finds the decision waiting.
    const { stored } = aSession();
    const reopened = openOver(stored);

    const item = readTimeline(reopened.campaign, reopened.events()).items.find(
      (each) => each.kind === 'check',
    );

    expect(item?.kind === 'check' && item.check.offers[0]?.fate).toBe('offered');
  });

  it('says it was refused once somebody refused it', () => {
    const session = aSession();
    answerOffer(session.campaign, { offerId: session.offerId, answer: { kind: 'declined' } });

    expect(offersFrom(session)[0]?.fate).toBe('declined');
  });

  it('says what was used instead when somebody changed it', () => {
    const session = aSession();
    answerOffer(session.campaign, {
      offerId: session.offerId,
      answer: { kind: 'adjusted', used: { by: -5 } },
    });

    const [only] = offersFrom(session);
    expect(only?.fate).toBe('adjusted');
    expect(only?.used).toEqual({ by: -5 });
  });

  it('carries what may still be changed about it', () => {
    expect(offersFrom(aSession())[0]?.fields.length).toBeGreaterThan(0);
  });
});

describe('the toy, which is the canary', () => {
  it('produces a card from the same timeline, with one die and nothing to answer', () => {
    const stored = aStoredLog();
    const { campaign, events } = openOver(stored);

    const ran = runCheck(campaign, {
      systemId: TOY_SYSTEM_ID,
      checkId: CALL_IT.id,
      inputs: {},
      thrown: [1],
    });

    if (!ran.ok) throw new Error(ran.failure.detail);

    const item = readTimeline(campaign, events()).items.find((each) => each.kind === 'check');
    if (item?.kind !== 'check') throw new Error('the timeline held no check');

    expect(item.check.name).toBe('Call it');
    expect(item.check.outcome.label).toBe('Heads');
    expect(item.check.outcome.tone).toBe('strong');
    expect(item.check.dice).toHaveLength(1);
    expect(item.check.offers).toEqual([]);
  });
});

describe('another module event that looks like a resolution', () => {
  it('is not turned into a card', () => {
    // The fault worth guarding against: a payload shaped like a resolution, of
    // a type no loaded system declared as one. Without the check on the type,
    // anything with the right fields would become somebody's card.
    const stored = aStoredLog();
    const { campaign, events } = openOver(stored);

    campaign.append({
      type: 'sys.ironsworn-starforged.momentum.changed',
      systemId: STARFORGED_SYSTEM_ID,
      payload: {
        check: FACE_DANGER.id,
        outcome: 'strong-hit',
        summary: 'This is not a resolution.',
        inputs: {},
      },
    });

    expect(readTimeline(campaign, events()).items).toEqual([]);
  });
});

describe('every outcome a check can produce', () => {
  it('has somewhere to be drawn from, in both modules', () => {
    // A missing entry is a card nobody can draw when the campaign is read back.
    // Only the module knows what its own interpret can return, so this walks
    // the rolls that actually produce each one.
    const anActionRoll = (action: number, first: number, second: number) => ({
      request: {
        dice: [
          { sides: 6, count: 1, label: 'action' },
          { sides: 10, count: 2, label: 'challenge' },
        ],
      },
      dice: [
        { sides: 6, value: action, source: { kind: 'digital' as const } },
        { sides: 10, value: first, source: { kind: 'digital' as const } },
        { sides: 10, value: second, source: { kind: 'digital' as const } },
      ],
    });

    const faceDanger = [
      FACE_DANGER.interpret(anActionRoll(6, 2, 3), { stat: 3, bonus: 0 }),
      FACE_DANGER.interpret(anActionRoll(4, 2, 9), { stat: 2, bonus: 0 }),
      FACE_DANGER.interpret(anActionRoll(1, 9, 9), { stat: 0, bonus: 0 }),
      FACE_DANGER.interpret(null, {}),
    ];

    for (const outcome of faceDanger) {
      expect(declaresStyleFor(FACE_DANGER, outcome), outcome.id).toBe(true);
    }

    const coin = (value: 1 | 2) => ({
      request: { dice: [{ sides: 2, count: 1, label: 'coin' }] },
      dice: [{ sides: 2, value, source: { kind: 'digital' as const } }],
    });

    for (const outcome of [CALL_IT.interpret(coin(1), {}), CALL_IT.interpret(coin(2), {})]) {
      expect(declaresStyleFor(CALL_IT, outcome), outcome.id).toBe(true);
    }
  });
});
