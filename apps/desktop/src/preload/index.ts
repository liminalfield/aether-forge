import { contextBridge, ipcRenderer } from 'electron';

import { IPC, type AetherForgeApi } from '../shared/ipc';

/**
 * Runs sandboxed with context isolation on. It may use Electron's renderer-side
 * IPC primitives and nothing else: no Node built-ins, no filesystem. Its only
 * job is to expose the typed contract on `window.aetherForge`.
 */
const api: AetherForgeApi = {
  getAppVersion: () => ipcRenderer.invoke(IPC.getAppVersion) as Promise<string>,
};

contextBridge.exposeInMainWorld('aetherForge', api);
