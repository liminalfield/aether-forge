import { contextBridge, ipcRenderer } from 'electron';

import {
  IPC,
  type AetherForgeApi,
  type IpcResult,
  type JournalView,
  type JournalEntryView,
} from '../shared/ipc';

/**
 * Runs sandboxed with context isolation on. It may use Electron's renderer-side
 * IPC primitives and nothing else: no Node built-ins, no filesystem. Its only
 * job is to expose the typed contract on `window.aetherForge`.
 */
const api: AetherForgeApi = {
  getAppVersion: () => ipcRenderer.invoke(IPC.getAppVersion) as Promise<string>,

  readJournal: () => ipcRenderer.invoke(IPC.readJournal) as Promise<IpcResult<JournalView>>,

  recordEntry: (text) =>
    ipcRenderer.invoke(IPC.recordEntry, text) as Promise<IpcResult<JournalEntryView>>,

  correctEntry: (entryId, text) =>
    ipcRenderer.invoke(IPC.correctEntry, entryId, text) as Promise<IpcResult<JournalEntryView>>,
};

contextBridge.exposeInMainWorld('aetherForge', api);
