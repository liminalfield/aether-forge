/**
 * The typed IPC contract — the *only* seam between the renderer and the
 * platform.
 *
 * The renderer is a normal web app that does not know Electron exists. Every
 * platform-shaped concern (storage, file dialogs, imports, package management,
 * blobs) crosses this boundary and nothing else does. This module is shared by
 * preload and renderer, so adding a channel here is the single edit that keeps
 * both sides in step.
 *
 * Bootstrap scope: one channel, to prove the pattern end to end.
 */

export const IPC = {
  getAppVersion: 'app:getVersion',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

/** Shape exposed on `window.aetherForge` by the preload script. */
export interface AetherForgeApi {
  getAppVersion(): Promise<string>;
}

declare global {
  interface Window {
    readonly aetherForge: AetherForgeApi;
  }
}
