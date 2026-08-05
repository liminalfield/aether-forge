/**
 * Saying what went wrong, in words.
 *
 * Failures carry structured fields rather than a message, because something
 * reacting to one should not be reading English. Something eventually has to
 * show a person what happened, and this is that.
 *
 * It lives on its own rather than beside any one failure type, so that it can
 * cover all of them without anything importing anything it should not.
 */

import type { ImportFailure } from './bundle.js';
import type { CampaignFailure } from './campaign.js';
import type { RollFailure } from './roll.js';

/** Anything core can report going wrong. */
export type CoreFailure = CampaignFailure | ImportFailure | RollFailure;

/**
 * The final branch is a compile-time check: adding a failure kind without
 * describing it here will not build.
 */
export function describeFailure(failure: CoreFailure): string {
  switch (failure.kind) {
    case 'storage-failed':
    case 'translation-failed':
      return failure.detail;

    case 'out-of-order':
      return (
        `an event arrived claiming position ${failure.given} when the campaign ` +
        `is expecting ${failure.expected}. Events cannot be stored out of order.`
      );

    case 'unknown-event-type':
      return `this build does not know the event type ${failure.type}`;

    case 'cannot-be-superseded':
      return (
        `a ${failure.type} records something that happened, so it cannot be replaced. ` +
        'Record a further change that compensates for it instead.'
      );

    case 'already-declared':
      return `the event type ${failure.type} was declared more than once`;

    case 'version-must-be-at-least-one':
      return `${failure.type} was given version ${failure.given}, and versions start at 1`;

    case 'incomplete-history':
      return (
        `${failure.type} has no translation from version ` +
        `${failure.missingSteps.join(', ')}, so an event written then could not be read`
      );

    case 'translation-for-another-type':
      return `a translation for ${failure.translationType} was declared under ${failure.type}`;

    case 'written-by-a-newer-version':
      return (
        `this campaign contains a ${failure.type} written by a newer version of ` +
        `Aether Forge (shape ${failure.storedVersion}; this build understands ${failure.knownVersion}). ` +
        'Update the application to open it.'
      );

    case 'projection-failed':
      return failure.detail;

    case 'unknown-bundle-format':
      return (
        `this file was written in bundle format ${failure.format}, which this build ` +
        'does not understand. Update the application to open it.'
      );

    case 'a-different-campaign':
      return (
        `this file holds a different campaign to the one open here, even though both ` +
        `are called ${failure.campaignId}. Import it as its own campaign instead.`
      );

    case 'diverged':
      return (
        'both copies of this campaign have been played since they were last together, ' +
        `agreeing up to event ${failure.agreedUntil}. They cannot be combined. ` +
        'Keep the imported one as a separate campaign.'
      );

    case 'die-outside-its-range':
      return (
        `a ${failure.sides}-sided die cannot show ${failure.value}. ` +
        'A die shows a whole number from 1 to the number of sides it has.'
      );

    case 'die-value-is-not-whole':
      return `a die cannot show ${failure.value}. Dice show whole numbers.`;

    case 'die-has-impossible-sides':
      return `a die cannot have ${failure.sides} sides`;

    case 'replacement-does-not-say-why':
      return (
        'this roll replaces an earlier one without saying whether it was corrected ' +
        'or rerolled. A history that cannot tell those apart is not a record.'
      );

    case 'says-why-but-replaces-nothing':
      return 'this roll says why it replaced a roll, and replaces none';

    default: {
      const unhandled: never = failure;
      return String(unhandled);
    }
  }
}
