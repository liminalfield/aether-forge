import {
  isModuleEvent,
  journal,
  readRoll,
  ROLL_PERFORMED,
  suggestions,
  type CheckDefinition,
  type EventEnvelope,
  type OpenCampaign,
  type RollPerformedV1,
  type SuggestionRecord,
} from '@aether-forge/core';

import type {
  JournalEntryView,
  RecordedOfferView,
  RecordedOutcomeView,
  RolledDieView,
  TimelineItem,
  TimelineView,
} from '../shared/ipc';
import { LOADED_SYSTEMS } from './systems';

/**
 * The campaign as one thing, in the order it happened.
 *
 * Prose and checks together, because that is what a session is. A journal that
 * held only the writing would make the rolls a separate history of the same
 * evening, and a person would have to read both to know what happened.
 *
 * What happened was written down when it happened and is never worked out
 * again. How it is drawn comes from the module as it stands today, because
 * presentation is not a fact: somebody who retheres, or updates a module that
 * renames a result, should see that over their old campaign rather than a
 * rewritten log.
 *
 * Core never reads inside a module's payload. This layer does, because it is
 * the layer that composes modules, and it reads only the two fields it put
 * there itself: which check ran, and which outcome it came to.
 */

/** The two fields this layer wrote into a module's resolution, read back. */
interface Resolution {
  readonly check: string;
  readonly outcome: string;
  readonly summary: string;
  readonly inputs: Readonly<Record<string, number>>;
}

function readResolution(payload: unknown): Resolution | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;

  const { check, outcome, summary, inputs } = payload as Record<string, unknown>;
  if (typeof check !== 'string' || typeof outcome !== 'string') return undefined;
  if (typeof summary !== 'string') return undefined;

  const numbers =
    typeof inputs === 'object' && inputs !== null && !Array.isArray(inputs)
      ? Object.fromEntries(Object.entries(inputs).filter(([, value]) => typeof value === 'number'))
      : {};

  return { check, outcome, summary, inputs: numbers as Record<string, number> };
}

function findCheck(systemId: string, checkId: string): CheckDefinition | undefined {
  return LOADED_SYSTEMS.find((system) => system.systemId === systemId)?.checks.find(
    (check) => check.id === checkId,
  );
}

/**
 * How to show an outcome, asked of the module that owns it.
 *
 * A module that has been removed, or that no longer declares this outcome,
 * leaves a card that still says what happened. It is drawn plainly rather than
 * hidden, because the campaign is a record and losing a page of it to a missing
 * package would be worse than showing it without its colour.
 */
function styleFor(check: CheckDefinition | undefined, resolution: Resolution): RecordedOutcomeView {
  const declared = check?.outcomes.find((style) => style.id === resolution.outcome);

  return declared === undefined
    ? {
        id: resolution.outcome,
        label: resolution.outcome,
        summary: resolution.summary,
        tone: 'match',
        glyph: '○',
      }
    : {
        id: resolution.outcome,
        label: declared.label,
        summary: resolution.summary,
        tone: declared.tone,
        glyph: declared.glyph,
      };
}

function toDiceView(roll: RollPerformedV1): readonly RolledDieView[] {
  const labels = roll.request.dice.flatMap((spec) =>
    Array.from({ length: spec.count }, () => spec.label),
  );

  return roll.dice.map((die, index) => {
    const from = die.source.kind === 'service' ? die.source.service : die.source.kind;
    const label = labels[index];

    return label === undefined
      ? { sides: die.sides, value: die.value, from }
      : { sides: die.sides, value: die.value, from, label };
  });
}

function toOfferView(record: SuggestionRecord): RecordedOfferView {
  const view: RecordedOfferView = {
    id: record.id,
    label: record.label,
    fields: [...record.fields],
    fate: record.fate,
  };

  const withWhy = record.why === undefined ? view : { ...view, why: record.why };
  return record.used === undefined ? withWhy : { ...withWhy, used: record.used };
}

/**
 * Everything in the campaign, oldest first.
 *
 * Walks the log once. A resolution is where a check becomes visible, because it
 * is the point at which there is something to say: the invocation on its own is
 * a check somebody started, and the roll on its own is three numbers.
 */
export function readTimeline(
  campaign: OpenCampaign,
  events: readonly EventEnvelope[],
): TimelineView {
  const entries = new Map(campaign.stateOf(journal).entries.map((entry) => [entry.id, entry]));
  const offers = campaign.stateOf(suggestions).offers;

  const items: TimelineItem[] = [];

  /** The most recent roll, which is what the resolution after it turned on. */
  let lastRoll: RollPerformedV1 | undefined;

  for (const event of events) {
    if (event.type === ROLL_PERFORMED) {
      lastRoll = readRoll(event.payload);
      continue;
    }

    const entry = entries.get(event.id);
    if (entry !== undefined) {
      const view: JournalEntryView = {
        id: entry.id,
        text: entry.text,
        currentVersionId: entry.currentVersionId,
        corrections: entry.corrections,
      };

      items.push({ kind: 'entry', at: event.at, entry: view });
      continue;
    }

    if (!isModuleEvent(event)) continue;

    // Only a resolution this build's modules declared. Another module's events
    // pass through untouched, which is the fault worth guarding against here.
    const resolves = LOADED_SYSTEMS.some((system) => system.checkEvents.resolved === event.type);
    if (!resolves) continue;

    const resolution = readResolution(event.payload);
    if (resolution === undefined) continue;

    const check = findCheck(event.systemId, resolution.check);

    items.push({
      kind: 'check',
      at: event.at,
      check: {
        id: event.id,
        checkId: resolution.check,
        systemId: event.systemId,
        name: check?.name ?? resolution.check,
        outcome: styleFor(check, resolution),
        dice: lastRoll === undefined ? [] : toDiceView(lastRoll),
        inputs: resolution.inputs,
        // Every offer this resolution caused, and what became of each. An
        // unanswered one is a decision still waiting, which is why it is here
        // at all rather than only in the run that made it.
        offers: offers.filter((offer) => causedBy(offer, event.id, events)).map(toOfferView),
      },
    });

    lastRoll = undefined;
  }

  return { items };
}

/** Whether an offer was made by this resolution, following the event's own causation. */
function causedBy(
  offer: SuggestionRecord,
  resolutionId: string,
  events: readonly EventEnvelope[],
): boolean {
  const offered = events.find((event) => event.id === offer.id);
  return offered?.causationId === resolutionId;
}
