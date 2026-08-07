import { describe, expect, it } from 'vitest';

import { openCampaign } from './campaign.js';
import { createMemoryEventLog } from './memory-log.js';
import type { Projection } from './projection.js';
import { createEventSchemas } from './schema.js';
import {
  readAdjustment,
  readOffer,
  SUGGESTION_ACCEPTED,
  SUGGESTION_ADJUSTED,
  SUGGESTION_DECLINED,
  SUGGESTION_OFFERED,
  suggestionEventTypes,
  suggestions,
  type SuggestionOfferedV1,
  type SuggestionOfferedV2,
} from './suggestion.js';
import { describeProjectionIsPredictable } from './testing/projection-contract.js';
import { describeSchemaTranslations } from './testing/schema-contract.js';
import { createTranslatingLog, type TranslatingLog } from './translating-log.js';

function aLog(): TranslatingLog {
  let tick = 0;
  const schemas = createEventSchemas();
  for (const definition of suggestionEventTypes) schemas.declare(definition);

  return createTranslatingLog(
    createMemoryEventLog({
      campaignId: 'campaign-under-test',
      now: () => `2026-08-06T09:00:0${(tick += 1)}.000Z`,
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

const AN_OFFER: SuggestionOfferedV2 = {
  suggestion: 'example.dummy/spend-one',
  label: 'Spend one from the resource',
  why: 'the approach was costly',
  proposes: {
    type: 'sys.example.resource.moved',
    systemId: 'example',
    payload: { by: -1, reason: 'a hard landing' },
  },
  fields: [
    { id: 'by', label: 'Amount', kind: 'number' },
    {
      id: 'reason',
      label: 'Why',
      kind: 'choice',
      options: [
        { id: 'landing', label: 'A hard landing', value: 1 },
        { id: 'weather', label: 'The weather', value: 2 },
      ],
    },
  ],
};

/**
 * An offer as version 1 wrote one, kept so the translation has a real input
 * rather than one built to suit it.
 */
const AN_OFFER_AS_VERSION_1: SuggestionOfferedV1 = {
  suggestion: 'example.dummy/spend-one',
  label: 'Spend one from the resource',
  why: 'the approach was costly',
  proposes: {
    type: 'sys.example.resource.moved',
    payload: { by: -1, reason: 'a hard landing' },
  },
};

describe('an offer', () => {
  it('survives being written and read back', () => {
    const campaign = openWith(aLog());
    const written = campaign.append({ type: SUGGESTION_OFFERED, payload: AN_OFFER });
    if (!written.ok) throw new Error('could not write');

    expect(readOffer(written.value.payload)).toEqual(AN_OFFER);
  });

  it('keeps the reason it gave', () => {
    // The reason is what makes a suggestion something a person can judge rather
    // than something that simply appeared.
    expect(readOffer(AN_OFFER)?.why).toBe('the approach was costly');
  });

  it('is fine without a reason', () => {
    const bare = {
      suggestion: 'example.dummy/spend-one',
      label: 'Spend one from the resource',
      proposes: { type: 'sys.example.resource.moved', payload: { by: -1 } },
      fields: [],
    };

    const read = readOffer(bare);
    expect(read).toBeDefined();
    expect(read).not.toHaveProperty('why');
  });

  it('carries the draft exactly as the module supplied it', () => {
    const read = readOffer(AN_OFFER);
    expect(read?.proposes.type).toBe('sys.example.resource.moved');
    expect(read?.proposes.payload).toEqual({ by: -1, reason: 'a hard landing' });
  });

  it('says which module the proposal belongs to', () => {
    // Without it, an offer read back on its own cannot be turned into an event
    // at all, because a module event is required to name its system.
    expect(readOffer(AN_OFFER)?.proposes.systemId).toBe('example');
  });

  it('leaves the system out for a proposal that belongs to core', () => {
    const proposingACoreEvent = {
      suggestion: 'example.dummy/write-it-down',
      label: 'Write it down',
      proposes: { type: 'core.entry.created', payload: { text: 'It answered.' } },
      fields: [],
    };

    expect(readOffer(proposingACoreEvent)?.proposes).not.toHaveProperty('systemId');
  });

  it('carries what a person may change, with the choices for each', () => {
    // The whole reason version 2 exists. An offer can be answered in a much
    // later session, and at that point the log is all there is.
    expect(readOffer(AN_OFFER)?.fields).toEqual(AN_OFFER.fields);
  });

  it('has enough to draw an adjust control without asking the module', () => {
    const read = readOffer(AN_OFFER);
    const choice = read?.fields.find((field) => field.kind === 'choice');

    expect(choice?.label).toBe('Why');
    expect(choice?.options?.map((option) => option.label)).toEqual([
      'A hard landing',
      'The weather',
    ]);
  });

  it.each([
    ['not an object', 7],
    ['no identifier', { label: 'x', proposes: { type: 'a', payload: {} }, fields: [] }],
    ['no label', { suggestion: 'a', proposes: { type: 'a', payload: {} }, fields: [] }],
    ['nothing proposed', { suggestion: 'a', label: 'x', fields: [] }],
    [
      'a proposal with no type',
      { suggestion: 'a', label: 'x', proposes: { payload: {} }, fields: [] },
    ],
    [
      'a reason that is not text',
      { suggestion: 'a', label: 'x', why: 7, proposes: { type: 'a', payload: {} }, fields: [] },
    ],
    [
      'a system that is not text',
      {
        suggestion: 'a',
        label: 'x',
        proposes: { type: 'a', systemId: 7, payload: {} },
        fields: [],
      },
    ],
    ['no fields at all', { suggestion: 'a', label: 'x', proposes: { type: 'a', payload: {} } }],
    [
      'fields that are not a list',
      { suggestion: 'a', label: 'x', proposes: { type: 'a', payload: {} }, fields: { by: {} } },
    ],
    [
      'a field of no known kind',
      {
        suggestion: 'a',
        label: 'x',
        proposes: { type: 'a', payload: {} },
        fields: [{ id: 'by', label: 'Amount', kind: 'colour' }],
      },
    ],
    [
      'a field with no label',
      {
        suggestion: 'a',
        label: 'x',
        proposes: { type: 'a', payload: {} },
        fields: [{ id: 'by', kind: 'number' }],
      },
    ],
    [
      'an option with no value',
      {
        suggestion: 'a',
        label: 'x',
        proposes: { type: 'a', payload: {} },
        fields: [{ id: 'by', label: 'Amount', kind: 'choice', options: [{ id: 'a', label: 'A' }] }],
      },
    ],
  ])('says no to %s', (_name, payload) => {
    expect(readOffer(payload)).toBeUndefined();
  });

  it('refuses the whole offer when one field of several is unreadable', () => {
    // Not skipped. Showing the readable ones would present a partial set of
    // controls as though it were the whole set.
    const partlyUnreadable = {
      suggestion: 'a',
      label: 'x',
      proposes: { type: 'a', payload: {} },
      fields: [
        { id: 'by', label: 'Amount', kind: 'number' },
        { id: 'reason', label: 'Why', kind: 'nonsense' },
      ],
    };

    expect(readOffer(partlyUnreadable)).toBeUndefined();
  });
});

/**
 * Runs the translations this build actually declares, rather than importing one
 * directly. A translation that is written but never declared would pass a test
 * that called it by name, and do nothing at all when a real log is read.
 */
function broughtUpToDate(payload: unknown): unknown {
  const declared = suggestionEventTypes.find(
    (definition) => definition.type === SUGGESTION_OFFERED,
  );

  return (declared?.translations ?? []).reduce<unknown>(
    (carried, step) => step.translate(carried),
    payload,
  );
}

describe('an offer written before version 2', () => {
  it('still reads, and says nothing about it can be changed', () => {
    // Truthful rather than convenient. Version 1 never recorded which parts
    // were adjustable, so an empty list is what is actually known.
    const brought = broughtUpToDate(AN_OFFER_AS_VERSION_1);

    expect(readOffer(brought)?.fields).toEqual([]);
  });

  it('does not guess which module its proposal belonged to', () => {
    // The type is namespaced sys.<systemId>.* by the module contract, so it
    // could have been read back out of the string. That is a naming convention
    // no code enforces, and a guess written into a translation is permanent.
    const brought = broughtUpToDate(AN_OFFER_AS_VERSION_1);

    expect(readOffer(brought)?.proposes).not.toHaveProperty('systemId');
  });

  it('keeps everything version 1 did record', () => {
    const brought = readOffer(broughtUpToDate(AN_OFFER_AS_VERSION_1));

    expect(brought?.label).toBe('Spend one from the resource');
    expect(brought?.why).toBe('the approach was costly');
    expect(brought?.proposes.payload).toEqual({ by: -1, reason: 'a hard landing' });
  });
});

describe('what happened to it', () => {
  function offerThen(answer: string, payload: unknown = {}) {
    const log = aLog();
    const campaign = openWith(log);

    const offered = campaign.append({ type: SUGGESTION_OFFERED, payload: AN_OFFER });
    if (!offered.ok) throw new Error('could not offer');

    const answered = campaign.append({
      type: answer,
      causationId: offered.value.id,
      payload,
    });
    if (!answered.ok) throw new Error(`could not record ${answer}`);

    const events = log.read();
    if (!events.ok) throw new Error('could not read');
    return { offered: offered.value, answered: answered.value, events: events.value };
  }

  it('records an acceptance against the offer it answers', () => {
    const { offered, answered } = offerThen(SUGGESTION_ACCEPTED);
    expect(answered.causationId).toBe(offered.id);
  });

  it('records a decline, and both events stay', () => {
    // The whole point. Without this, a campaign where every suggestion was
    // taken and one where none were ever offered look identical.
    const { events } = offerThen(SUGGESTION_DECLINED);

    expect(events.map((event) => event.type)).toEqual([SUGGESTION_OFFERED, SUGGESTION_DECLINED]);
  });

  it('records what a player used instead, alongside what was proposed', () => {
    const { offered, answered } = offerThen(SUGGESTION_ADJUSTED, { used: { by: -2 } });

    expect(readAdjustment(answered.payload)?.used).toEqual({ by: -2 });
    expect(readOffer(offered.payload)?.proposes.payload).toEqual({
      by: -1,
      reason: 'a hard landing',
    });
  });

  it('says nothing on an acceptance beyond which offer it answers', () => {
    // A second copy of the offer's identifier in the payload would be two
    // records of one fact.
    const { answered } = offerThen(SUGGESTION_ACCEPTED);
    expect(answered.payload).toEqual({});
  });
});

describe('reading an adjustment', () => {
  it.each([
    ['not an object', 7],
    ['nothing used', {}],
    ['a used that is not an object', { used: 'more' }],
  ])('says no to %s', (_name, payload) => {
    expect(readAdjustment(payload)).toBeUndefined();
  });
});

describe('how a suggestion event can be corrected', () => {
  it('lets an offer be replaced and refuses to replace an answer', () => {
    // An offer says what was proposed, which can be restated. An acceptance
    // says what a person did, which happened. Changing your mind later is a
    // further event rather than a rewriting of the moment you decided.
    const schemas = createEventSchemas();
    for (const definition of suggestionEventTypes) schemas.declare(definition);

    const offered = schemas.correctionStyle(SUGGESTION_OFFERED);
    const accepted = schemas.correctionStyle(SUGGESTION_ACCEPTED);
    const declined = schemas.correctionStyle(SUGGESTION_DECLINED);

    expect(offered.ok && offered.value).toBe('replaces-a-value');
    expect(accepted.ok && accepted.value).toBe('records-a-change');
    expect(declined.ok && declined.value).toBe('records-a-change');
  });
});

describeSchemaTranslations(
  'core suggestion events',
  () => {
    const schemas = createEventSchemas();
    for (const definition of suggestionEventTypes) schemas.declare(definition);
    return schemas;
  },
  [
    {
      type: SUGGESTION_OFFERED,
      payloadsByVersion: { 1: AN_OFFER_AS_VERSION_1, 2: { ...AN_OFFER_AS_VERSION_1, fields: [] } },
    },
    { type: SUGGESTION_ACCEPTED, payloadsByVersion: { 1: {} } },
    { type: SUGGESTION_ADJUSTED, payloadsByVersion: { 1: { used: { by: -2 } } } },
    { type: SUGGESTION_DECLINED, payloadsByVersion: { 1: {} } },
  ],
);

describe('what became of every suggestion', () => {
  function openWithSuggestions() {
    const log = aLog();
    const opened = openCampaign(log, { projections: [suggestions as Projection<unknown>] });
    if (!opened.ok) throw new Error(`could not open: ${opened.failure.kind}`);
    return opened.value;
  }

  function offer(campaign: ReturnType<typeof openWithSuggestions>, id: string) {
    const written = campaign.append({
      type: SUGGESTION_OFFERED,
      payload: { ...AN_OFFER, suggestion: id },
    });
    if (!written.ok) throw new Error('could not offer');
    return written.value.id;
  }

  it('shows one nobody has answered yet', () => {
    // A real state rather than a missing one. A suggestion can sit unanswered
    // for as long as a person likes.
    const campaign = openWithSuggestions();
    offer(campaign, 'example.dummy/one');

    expect(campaign.stateOf(suggestions).offers.map((each) => each.fate)).toEqual(['offered']);
  });

  it('keeps a declined suggestion, and says it was declined', () => {
    const campaign = openWithSuggestions();
    const offered = offer(campaign, 'example.dummy/one');
    campaign.append({ type: SUGGESTION_DECLINED, causationId: offered, payload: {} });

    const [only] = campaign.stateOf(suggestions).offers;
    expect(only?.fate).toBe('declined');
    expect(only?.label).toBe('Spend one from the resource');
  });

  it('records what a player used when they adjusted it', () => {
    const campaign = openWithSuggestions();
    const offered = offer(campaign, 'example.dummy/one');
    campaign.append({
      type: SUGGESTION_ADJUSTED,
      causationId: offered,
      payload: { used: { by: -2 } },
    });

    const [only] = campaign.stateOf(suggestions).offers;
    expect(only?.fate).toBe('adjusted');
    expect(only?.used).toEqual({ by: -2 });
    // What was proposed is still there beside what was used.
    expect(only?.proposes.payload).toEqual({ by: -1, reason: 'a hard landing' });
  });

  it('keeps several suggestions apart', () => {
    const campaign = openWithSuggestions();
    const first = offer(campaign, 'example.dummy/one');
    const second = offer(campaign, 'example.dummy/two');

    campaign.append({ type: SUGGESTION_ACCEPTED, causationId: first, payload: {} });
    campaign.append({ type: SUGGESTION_DECLINED, causationId: second, payload: {} });

    expect(campaign.stateOf(suggestions).offers.map((each) => each.fate)).toEqual([
      'accepted',
      'declined',
    ]);
  });

  it.each([
    ['an answer to something it has never seen', { causationId: 'event-nobody-offered' }],
    ['an answer that points at nothing', {}],
  ])('ignores %s entirely', (_name, extra) => {
    const campaign = openWithSuggestions();
    const before = campaign.stateOf(suggestions);

    campaign.append({ type: SUGGESTION_DECLINED, ...extra, payload: {} });

    expect(campaign.stateOf(suggestions)).toEqual(before);
  });

  it('ignores an offer that is not one', () => {
    const campaign = openWithSuggestions();
    campaign.append({ type: SUGGESTION_OFFERED, payload: { nonsense: true } });

    expect(campaign.stateOf(suggestions).offers).toEqual([]);
  });

  it('lets a person change an answer by answering again', () => {
    // Not a correction. The first answer happened and stays in the log; this is
    // a second decision, later.
    const campaign = openWithSuggestions();
    const offered = offer(campaign, 'example.dummy/one');

    campaign.append({ type: SUGGESTION_DECLINED, causationId: offered, payload: {} });
    campaign.append({ type: SUGGESTION_ACCEPTED, causationId: offered, payload: {} });

    expect(campaign.stateOf(suggestions).offers[0]?.fate).toBe('accepted');
  });
});

describeProjectionIsPredictable(
  'what became of every suggestion',
  () => suggestions,
  () => [
    {
      id: 'event-1',
      seq: 1,
      at: '2026-08-06T09:00:01.000Z',
      type: SUGGESTION_OFFERED,
      schemaVersion: 2,
      payload: AN_OFFER,
    },
    {
      id: 'event-2',
      seq: 2,
      at: '2026-08-06T09:00:02.000Z',
      type: SUGGESTION_DECLINED,
      schemaVersion: 1,
      causationId: 'event-1',
      payload: {},
    },
  ],
);
