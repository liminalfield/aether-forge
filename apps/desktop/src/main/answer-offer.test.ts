import {
  createMemoryEventLog,
  createTranslatingLog,
  openCampaign,
  suggestions,
  type EventEnvelope,
  type EventLog,
  type OpenCampaign,
  type Projection,
} from '@aether-forge/core';
import {
  FACE_DANGER,
  momentum,
  MOMENTUM_CHANGED,
  STARFORGED_SYSTEM_ID,
} from '@aether-forge/system-ironsworn';
import { asProjection } from '@aether-forge/core/testing';
import { describe, expect, it } from 'vitest';

import { answerOffer } from './answer-offer';
import { declareEventTypes } from './event-types';
import { runCheck } from './run-check';

/**
 * A campaign that can be closed and opened again over the same events, which is
 * the only way to test a claim about what survives a restart.
 */
function aStoredLog(): EventLog {
  let tick = 0;
  return createMemoryEventLog({
    campaignId: 'campaign-under-test',
    now: () => `2026-08-07T09:00:00.${String(1000 + (tick += 1)).slice(1)}Z`,
    nextEventId: () => `event-${String(tick)}`,
  });
}

function openOver(
  stored: EventLog,
  projections: readonly Projection<unknown>[] = [],
): OpenCampaign {
  const opened = openCampaign(createTranslatingLog(stored, declareEventTypes()), {
    projections: [suggestions as Projection<unknown>, ...projections],
  });

  if (!opened.ok) throw new Error('could not open the campaign');
  return opened.value;
}

/**
 * The module's own view, treated as an ordinary projection.
 *
 * Through core's own helper rather than a cast. A cast here would be silencing
 * the type rather than modelling it, and the helper also supplies the context a
 * module projection is handed.
 */
const momentumAsAProjection = (): Projection<unknown> =>
  asProjection(momentum) as Projection<unknown>;

const THREW = [4, 2, 9];

/** A check run and left with its offer on the table. */
function aRunWithAnOfferWaiting(stored: EventLog = aStoredLog()) {
  const campaign = openOver(stored, [momentumAsAProjection()]);

  const ran = runCheck(campaign, {
    systemId: STARFORGED_SYSTEM_ID,
    checkId: FACE_DANGER.id,
    inputs: { stat: 2, bonus: 0 },
    thrown: THREW,
  });

  if (!ran.ok) throw new Error(`the check did not run: ${ran.failure.detail}`);

  const offerId = ran.value.offers[0]?.id;
  if (offerId === undefined) throw new Error('the run left no offer to answer');

  return { campaign, stored, offerId, view: ran.value };
}

function eventsIn(stored: EventLog): readonly EventEnvelope[] {
  const read = stored.read();
  if (!read.ok) throw new Error('could not read the log');
  return read.value;
}

describe('refusing', () => {
  it('writes the refusal and nothing else', () => {
    // The whole promise, in one assertion. There is no path that appends what a
    // suggestion proposed without an answer that took it.
    const { campaign, stored, offerId } = aRunWithAnOfferWaiting();
    const before = eventsIn(stored).length;

    const answered = answerOffer(campaign, { offerId, answer: { kind: 'declined' } });

    expect(answered.ok && answered.value.fate).toBe('declined');
    expect(answered.ok && answered.value.appliedEventId).toBeUndefined();
    expect(eventsIn(stored)).toHaveLength(before + 1);
    expect(eventsIn(stored).map((event) => event.type)).not.toContain(MOMENTUM_CHANGED);
  });

  it('leaves the campaign exactly as it was', () => {
    const { campaign, offerId } = aRunWithAnOfferWaiting();
    const before = campaign.stateOf(momentumAsAProjection());

    answerOffer(campaign, { offerId, answer: { kind: 'declined' } });

    expect(campaign.stateOf(momentumAsAProjection())).toEqual(before);
  });

  it('records that the person was asked', () => {
    // Without this, a campaign where every suggestion was taken and one where
    // none were ever offered look identical.
    const { campaign, offerId } = aRunWithAnOfferWaiting();
    answerOffer(campaign, { offerId, answer: { kind: 'declined' } });

    const offer = campaign.stateOf(suggestions).offers.find((each) => each.id === offerId);
    expect(offer?.fate).toBe('declined');
    expect(offer?.label).not.toBe('');
  });
});

describe('taking it', () => {
  it('writes the answer and what it proposed, joined to each other', () => {
    const { campaign, stored, offerId } = aRunWithAnOfferWaiting();

    const answered = answerOffer(campaign, { offerId, answer: { kind: 'accepted' } });
    if (!answered.ok) throw new Error(answered.failure.detail);

    const events = eventsIn(stored);
    const applied = events.find((event) => event.id === answered.value.appliedEventId);
    const answer = events.find((event) => event.id === applied?.causationId);

    expect(applied?.type).toBe(MOMENTUM_CHANGED);
    expect(answer?.causationId).toBe(offerId);
    expect(answered.value.fate).toBe('accepted');
  });

  it('changes the campaign by what the module proposed', () => {
    const { campaign, offerId } = aRunWithAnOfferWaiting();
    const before = campaign.stateOf(momentumAsAProjection());

    answerOffer(campaign, { offerId, answer: { kind: 'accepted' } });

    expect(campaign.stateOf(momentumAsAProjection())).not.toEqual(before);
  });
});

describe('changing it before taking it', () => {
  it('writes what the person used instead, and keeps what was proposed', () => {
    const { campaign, stored, offerId } = aRunWithAnOfferWaiting();

    const answered = answerOffer(campaign, {
      offerId,
      answer: { kind: 'adjusted', used: { by: -5 } },
    });

    if (!answered.ok) throw new Error(answered.failure.detail);

    const applied = eventsIn(stored).find((event) => event.id === answered.value.appliedEventId);
    expect((applied?.payload as { by: number }).by).toBe(-5);

    // What was proposed is still in the offer, beside what was used.
    const offer = campaign.stateOf(suggestions).offers.find((each) => each.id === offerId);
    expect(offer?.fate).toBe('adjusted');
    expect(offer?.used).toEqual({ by: -5 });
  });

  it('keeps the parts of the proposal nobody changed', () => {
    const { campaign, stored, offerId } = aRunWithAnOfferWaiting();

    const answered = answerOffer(campaign, {
      offerId,
      answer: { kind: 'adjusted', used: { by: -5 } },
    });

    if (!answered.ok) throw new Error(answered.failure.detail);

    const applied = eventsIn(stored).find((event) => event.id === answered.value.appliedEventId);
    expect(applied?.payload).toHaveProperty('reason');
  });
});

describe('an offer nobody has answered', () => {
  it('is still unanswered after the application is closed and opened again', () => {
    // The gate, and the reason the two acts are two. Somebody interrupted
    // mid-decision should find the decision waiting rather than gone.
    const { stored, offerId } = aRunWithAnOfferWaiting();

    // A different campaign object over the same events, which is what opening
    // the application again actually is.
    const reopened = openOver(stored);
    const offer = reopened.stateOf(suggestions).offers.find((each) => each.id === offerId);

    expect(offer?.fate).toBe('offered');
  });

  it('can still be answered in that later session', () => {
    const { stored, offerId } = aRunWithAnOfferWaiting();
    const reopened = openOver(stored, [momentumAsAProjection()]);

    const answered = answerOffer(reopened, { offerId, answer: { kind: 'accepted' } });

    expect(answered.ok && answered.value.fate).toBe('accepted');
    expect(answered.ok && answered.value.appliedEventId).toBeDefined();
  });

  it('is answered from the log alone, with no module asked anything', () => {
    // What #124 recorded the fields and the system for. The module that made
    // the offer may not be the module answering it a year later.
    const { stored, offerId } = aRunWithAnOfferWaiting();
    const reopened = openOver(stored);

    const offer = reopened.stateOf(suggestions).offers.find((each) => each.id === offerId);

    expect(offer?.proposes.systemId).toBe(STARFORGED_SYSTEM_ID);
    expect(offer?.fields.length).toBeGreaterThan(0);
  });
});

describe('answering again, later', () => {
  it('is a second decision rather than a correction', () => {
    // The first answer happened and stays in the log. Nothing is rewritten.
    const { campaign, stored, offerId } = aRunWithAnOfferWaiting();

    answerOffer(campaign, { offerId, answer: { kind: 'declined' } });
    const answered = answerOffer(campaign, { offerId, answer: { kind: 'accepted' } });

    expect(answered.ok && answered.value.fate).toBe('accepted');

    const types = eventsIn(stored).map((event) => event.type);
    expect(types).toContain('core.suggestion.declined');
    expect(types).toContain('core.suggestion.accepted');
  });
});

describe('what it refuses', () => {
  it('refuses an offer this campaign has never seen', () => {
    const { campaign } = aRunWithAnOfferWaiting();

    const answered = answerOffer(campaign, {
      offerId: 'event-nobody-offered',
      answer: { kind: 'accepted' },
    });

    expect(!answered.ok && answered.failure.kind).toBe('unknown-offer');
  });

  it.each([
    ['nothing at all', undefined],
    ['not an object', 7],
    ['no offer named', { answer: { kind: 'accepted' } }],
    ['no answer', { offerId: 'event-1' }],
    ['an answer of no known kind', { offerId: 'event-1', answer: { kind: 'maybe' } }],
    ['an adjustment with nothing used', { offerId: 'event-1', answer: { kind: 'adjusted' } }],
  ])('refuses a request that is %s', (_name, request) => {
    const { campaign } = aRunWithAnOfferWaiting();
    const answered = answerOffer(campaign, request);

    expect(!answered.ok && answered.failure.kind).toBe('invalid-request');
  });
});
