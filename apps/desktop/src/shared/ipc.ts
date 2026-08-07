/**
 * The typed IPC contract, the *only* seam between the renderer and the
 * platform.
 *
 * The renderer is a normal web app that does not know Electron exists. Every
 * platform-shaped concern (storage, file dialogs, imports, package management,
 * blobs) crosses this boundary and nothing else does. This module is shared by
 * preload and renderer, so adding a channel here is the single edit that keeps
 * both sides in step.
 *
 * Channels are shaped around what the window wants to do, not around the store
 * underneath. There is no "append any event" channel, because that would let
 * the window write anything into the log. Each action gets a channel, and
 * adding one is a deliberate act.
 */

export const IPC = {
  getAppVersion: 'app:getVersion',
  readJournal: 'journal:read',
  recordEntry: 'journal:recordEntry',
  correctEntry: 'journal:correctEntry',
  readTimeline: 'journal:readTimeline',
  readChecks: 'checks:read',
  runCheck: 'checks:run',
  answerOffer: 'checks:answerOffer',
  readPreferences: 'preferences:read',
  setMotionPreference: 'preferences:setMotion',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

/**
 * A failure, reduced to what can safely cross a process boundary.
 *
 * Deliberately not the failure type core uses. That one can carry whatever the
 * storage layer caught, which may be an Error with a stack, or something not
 * worth serialising at all. Only the readable parts cross.
 */
export interface IpcFailure {
  readonly kind: string;
  readonly detail: string;
}

/**
 * Something went wrong, said in the return value rather than by rejecting.
 *
 * A failure reaching the window is expected behaviour, not an exception. The
 * window has to show it either way, and a value is harder to forget than a
 * rejected promise.
 */
export type IpcResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly failure: IpcFailure };

/**
 * One entry, as the window needs it.
 *
 * Deliberately not the shape core keeps. The journal projection also carries
 * the bookkeeping that traces a correction back to the entry it belongs to,
 * which is how it is worked out and none of the window's business. A channel
 * is shaped around what is being asked for, not around what happens to be
 * lying nearby.
 */
export interface JournalEntryView {
  /** Identifies the entry. Unchanged by corrections. */
  readonly id: string;
  readonly text: string;
  /** What a correction of this entry should supersede. */
  readonly currentVersionId: string;
  /** How many times it has been corrected. Zero for most entries. */
  readonly corrections: number;
}

export interface JournalView {
  /** In the order they were written, oldest first. */
  readonly entries: readonly JournalEntryView[];
}

/**
 * Everything in a campaign, in the order it happened.
 *
 * Prose and checks together, because that is what a session is. A journal that
 * held only the writing would make the rolls a separate history of the same
 * evening, and a person would have to read both to know what happened.
 */
export interface TimelineView {
  readonly items: readonly TimelineItem[];
}

export type TimelineItem =
  | { readonly kind: 'entry'; readonly at: string; readonly entry: JournalEntryView }
  | { readonly kind: 'check'; readonly at: string; readonly check: RecordedCheckView };

/**
 * A check as the log holds it, complete enough to draw without asking a module
 * anything about what happened.
 *
 * How it is drawn does come from the module, because presentation is not a fact
 * and somebody who updates a module should see the new presentation over their
 * old campaign. What happened was written down and is never worked out again.
 */
export interface RecordedCheckView {
  /** The event that resolved it, which is what identifies it on screen. */
  readonly id: string;
  readonly checkId: string;
  readonly systemId: string;
  /** The module's name for it, or the identifier when the module is gone. */
  readonly name: string;
  readonly outcome: RecordedOutcomeView;
  readonly dice: readonly RolledDieView[];
  /** What it ran with, in the order the module declares its inputs. */
  readonly inputs: readonly RecordedInputView[];
  readonly offers: readonly RecordedOfferView[];
}

/** One value a check ran with, named so the card can say it in words. */
export interface RecordedInputView {
  readonly id: string;
  /** The module's word for it, or the identifier when the module is gone. */
  readonly label: string;
  readonly value: number;
}

export interface RecordedOutcomeView {
  readonly id: string;
  readonly label: string;
  readonly summary: string;
  readonly tone: 'strong' | 'weak' | 'miss' | 'match';
  readonly glyph: string;
}

/** An offer, and what became of it. */
export interface RecordedOfferView extends OfferView {
  readonly fate: OfferFate;
  /** What the person used instead, when they changed it before taking it. */
  readonly used?: Readonly<Record<string, unknown>>;
  /** When somebody answered it. Absent while the offer is still waiting. */
  readonly answeredAt?: string;
}

/** One of the values an input offers, when it offers a fixed set. */
export interface CheckOptionView {
  readonly id: string;
  readonly label: string;
  readonly value: number;
}

/**
 * One thing a check needs a number for, described well enough to draw.
 *
 * The window cannot know what any of these are called. It is told what to put
 * on screen, and it draws that, which is the only arrangement under which a
 * second game system can arrive without the window changing.
 */
export interface CheckInputView {
  readonly id: string;
  readonly label: string;
  readonly kind: 'choice' | 'number';
  /** Present when the kind is `choice`. */
  readonly options?: readonly CheckOptionView[];
}

/** Dice a check asks for, before any of them have been rolled or thrown. */
export interface CheckDiceView {
  readonly sides: number;
  readonly count: number;
  /** What the module calls them. Dice sharing a label belong together. */
  readonly label?: string;
}

/**
 * A check, as the window needs it.
 *
 * Deliberately not the shape a module declares. That one carries `interpret`,
 * which is a function and cannot cross a process boundary, and `suggest`, which
 * is another. What crosses is data the window can draw.
 */
export interface CheckView {
  readonly id: string;
  readonly systemId: string;
  readonly name: string;
  /** Where the full text lives, for anything that wants to link to it. */
  readonly docRef?: string;
  /** Absent for a check with no dice at all. */
  readonly dice?: readonly CheckDiceView[];
  readonly inputs: readonly CheckInputView[];
}

export interface ChecksView {
  /** Every check every loaded system declares, grouped by system in load order. */
  readonly checks: readonly CheckView[];
}

/** One die, and what it showed. */
export interface RolledDieView {
  readonly sides: number;
  readonly value: number;
  /** What the module called it, when it called it anything. */
  readonly label?: string;
  /**
   * Whether the outcome turned on this die, which the module says and the
   * card draws. Absent when the module does not say.
   */
  readonly emphasis?: boolean;
  /**
   * Where the number came from: `digital`, `manual`, or the name of the service
   * that supplied it.
   *
   * The window shows this and never behaves differently because of it. A die
   * somebody threw on their table and a die the application rolled reach
   * exactly the same card.
   */
  readonly from: string;
}

/** A part of a proposal a person may change before taking it. */
export interface ProposalFieldView {
  readonly id: string;
  readonly label: string;
  readonly kind: 'number' | 'choice' | 'text';
  readonly options?: readonly CheckOptionView[];
}

/**
 * Something the module proposed doing about the outcome, waiting for an answer.
 *
 * `id` is the event that offered it, and it is what answering names. An offer
 * outlives the window that made it: close the application with one unanswered
 * and it is still unanswered on the way back in.
 */
export interface OfferView {
  readonly id: string;
  readonly label: string;
  readonly why?: string;
  /** What may be changed about it. Empty when nothing may be. */
  readonly fields: readonly ProposalFieldView[];
}

/** What a check came to, and what the module proposes doing about it. */
export interface CheckOutcomeView {
  readonly id: string;
  readonly label: string;
  readonly summary: string;
}

/**
 * One check, run.
 *
 * What comes back from the first of the two acts. The offers are in the log and
 * nobody has answered them, which is the state this whole surface is shaped
 * around.
 */
export interface CheckRunView {
  readonly checkId: string;
  readonly systemId: string;
  readonly name: string;
  readonly outcome: CheckOutcomeView;
  readonly dice: readonly RolledDieView[];
  readonly offers: readonly OfferView[];
}

/** What the window asks for when it wants a check run. */
export interface RunCheckRequest {
  readonly systemId: string;
  readonly checkId: string;
  /** A number for each input the check takes. */
  readonly inputs: Readonly<Record<string, number>>;
  /**
   * Die values somebody threw themselves, in the order the check asks for them.
   *
   * Absent means the application rolls. This is manual entry rather than a way
   * in for tests: somebody with real dice on the table types in what they
   * showed, and everything downstream is identical either way.
   */
  readonly thrown?: readonly number[];
}

/** What a person decided about one offer. */
export type OfferAnswer =
  | { readonly kind: 'accepted' }
  | { readonly kind: 'declined' }
  | { readonly kind: 'adjusted'; readonly used: Readonly<Record<string, unknown>> };

/** What the window says when a person answers an offer. */
export interface AnswerOfferRequest {
  /** The event that made the offer, which is what names it. */
  readonly offerId: string;
  readonly answer: OfferAnswer;
}

/**
 * What became of an offer.
 *
 * `offered` means nobody has answered it yet, which is a real state rather than
 * a missing one and survives closing the application.
 */
export type OfferFate = 'offered' | 'accepted' | 'adjusted' | 'declined';

/** An offer as it now stands, after somebody answered it. */
export interface AnsweredOfferView {
  readonly offerId: string;
  readonly fate: OfferFate;
  /**
   * The event the answer wrote, when the answer took the proposal.
   *
   * Absent for a refusal, and that absence is the whole promise: refusing
   * writes the refusal and nothing else.
   */
  readonly appliedEventId?: string;
}

/**
 * What a person has chosen about how the application behaves for them.
 *
 * Not part of a campaign and not part of a theme. It belongs to the person and
 * their machine, so it does not travel with either.
 */
export interface PreferencesView {
  /** `follow-the-system`, `on` or `off`. Kept as text, so an unknown value can cross and be refused. */
  readonly motion: string;
}

/** Shape exposed on `window.aetherForge` by the preload script. */
export interface AetherForgeApi {
  getAppVersion(): Promise<string>;

  /** Every entry in the campaign, oldest first. */
  readJournal(): Promise<IpcResult<JournalView>>;

  /**
   * Everything in the campaign, prose and checks together, oldest first.
   *
   * What the window draws. `readJournal` remains for anything that wants the
   * writing alone.
   */
  readTimeline(): Promise<IpcResult<TimelineView>>;

  /**
   * Write a journal entry into the campaign log.
   *
   * Answers with the entry as recorded, so the window can show it without
   * asking for the whole journal again.
   */
  recordEntry(text: string): Promise<IpcResult<JournalEntryView>>;

  /**
   * Change what an entry says.
   *
   * Nothing is edited. A correction is appended that supersedes the entry's
   * current version, and both stay in the log forever.
   *
   * Takes the entry rather than the version being superseded, so that a window
   * holding a stale view cannot supersede the wrong thing. Which version that
   * is gets worked out where the state actually lives.
   */
  correctEntry(entryId: string, text: string): Promise<IpcResult<JournalEntryView>>;

  /**
   * Every check the loaded systems declare, described well enough to draw.
   *
   * Listing what is declared, which is not the same as a browser for choosing
   * among many. The window needs this to draw one check without knowing which
   * game it belongs to.
   */
  readChecks(): Promise<IpcResult<ChecksView>>;

  /**
   * Run a check and write what it produced.
   *
   * The first of two acts. This writes the invocation, the roll, the resolution
   * and the offers, and answers with the outcome so the window can show it.
   * What the player decides about each offer is said separately, because a
   * person cannot answer a suggestion they have not seen.
   */
  runCheck(request: RunCheckRequest): Promise<IpcResult<CheckRunView>>;

  /**
   * Say what a person decided about one offer.
   *
   * The second of the two acts, and it can happen a second after the first or
   * in a session next year. An offer nobody has answered stays in the log
   * waiting, so somebody interrupted mid-decision finds the decision still
   * there.
   *
   * Answering again is allowed. It is not a correction: the first answer
   * happened and stays in the log, and this is a second decision, later.
   */
  answerOffer(request: AnswerOfferRequest): Promise<IpcResult<AnsweredOfferView>>;

  /** What this person has chosen. Answers with the defaults when nothing is stored. */
  readPreferences(): Promise<IpcResult<PreferencesView>>;

  /**
   * Choose whether the application moves.
   *
   * Answers with the preferences as they now stand, so the window does not have
   * to ask again, and so it learns immediately if the value was refused.
   */
  setMotionPreference(motion: string): Promise<IpcResult<PreferencesView>>;
}

declare global {
  interface Window {
    readonly aetherForge: AetherForgeApi;
  }
}
