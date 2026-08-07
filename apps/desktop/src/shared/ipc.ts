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
  readChecks: 'checks:read',
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
