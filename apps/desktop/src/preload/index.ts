import { contextBridge, ipcRenderer } from 'electron';

import {
  IPC,
  type AetherForgeApi,
  type AnsweredOfferView,
  type CheckRunView,
  type ChecksView,
  type IpcResult,
  type JournalView,
  type JournalEntryView,
  type PreferencesView,
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

  readChecks: () => ipcRenderer.invoke(IPC.readChecks) as Promise<IpcResult<ChecksView>>,

  runCheck: (request) =>
    ipcRenderer.invoke(IPC.runCheck, request) as Promise<IpcResult<CheckRunView>>,

  answerOffer: (request) =>
    ipcRenderer.invoke(IPC.answerOffer, request) as Promise<IpcResult<AnsweredOfferView>>,

  readPreferences: () =>
    ipcRenderer.invoke(IPC.readPreferences) as Promise<IpcResult<PreferencesView>>,

  setMotionPreference: (motion) =>
    ipcRenderer.invoke(IPC.setMotionPreference, motion) as Promise<IpcResult<PreferencesView>>,
};

contextBridge.exposeInMainWorld('aetherForge', api);
