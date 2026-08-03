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
  recordEntry: 'journal:recordEntry',
  countEvents: 'log:countEvents',
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

/** What was recorded, as far as the window needs to know. */
export interface RecordedEntry {
  readonly seq: number;
}

/** Shape exposed on `window.aetherForge` by the preload script. */
export interface AetherForgeApi {
  getAppVersion(): Promise<string>;

  /** Write a journal entry into the campaign log. */
  recordEntry(text: string): Promise<IpcResult<RecordedEntry>>;

  /** How many events this campaign has recorded. */
  countEvents(): Promise<IpcResult<number>>;
}

declare global {
  interface Window {
    readonly aetherForge: AetherForgeApi;
  }
}
