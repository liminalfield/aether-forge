import { contextBridge, ipcRenderer } from 'electron';

import {
  IPC,
  type AetherForgeApi,
  type AnsweredOfferView,
  type CheckRunView,
  type ChecksView,
  type IpcResult,
  type JournalView,
  type TimelineView,
  type JournalEntryView,
  type PreferencesView,
  type EntitiesView,
  type EntityTypesView,
  type ConsultationView,
  type OracleSearchView,
  type ReferenceDocView,
  type PackagesView,
  type ImportedPackagesView,
  type EntityView,
} from '../shared/ipc';

/**
 * Runs sandboxed with context isolation on. It may use Electron's renderer-side
 * IPC primitives and nothing else: no Node built-ins, no filesystem. Its only
 * job is to expose the typed contract on `window.aetherForge`.
 */
const api: AetherForgeApi = {
  getAppVersion: () => ipcRenderer.invoke(IPC.getAppVersion) as Promise<string>,

  readJournal: () => ipcRenderer.invoke(IPC.readJournal) as Promise<IpcResult<JournalView>>,

  readTimeline: () => ipcRenderer.invoke(IPC.readTimeline) as Promise<IpcResult<TimelineView>>,

  recordEntry: (text) =>
    ipcRenderer.invoke(IPC.recordEntry, text) as Promise<IpcResult<JournalEntryView>>,

  correctEntry: (entryId, text) =>
    ipcRenderer.invoke(IPC.correctEntry, entryId, text) as Promise<IpcResult<JournalEntryView>>,

  readChecks: () => ipcRenderer.invoke(IPC.readChecks) as Promise<IpcResult<ChecksView>>,

  runCheck: (request) =>
    ipcRenderer.invoke(IPC.runCheck, request) as Promise<IpcResult<CheckRunView>>,

  answerOffer: (request) =>
    ipcRenderer.invoke(IPC.answerOffer, request) as Promise<IpcResult<AnsweredOfferView>>,

  readEntities: () => ipcRenderer.invoke(IPC.readEntities) as Promise<IpcResult<EntitiesView>>,

  createEntity: (request) =>
    ipcRenderer.invoke(IPC.createEntity, request) as Promise<IpcResult<EntityView>>,

  changeEntity: (request) =>
    ipcRenderer.invoke(IPC.changeEntity, request) as Promise<IpcResult<EntityView>>,

  listPackages: () => ipcRenderer.invoke(IPC.listPackages) as Promise<IpcResult<PackagesView>>,

  importPackage: () =>
    ipcRenderer.invoke(IPC.importPackage) as Promise<IpcResult<ImportedPackagesView>>,

  searchOracles: (query) =>
    ipcRenderer.invoke(IPC.searchOracles, query) as Promise<IpcResult<OracleSearchView>>,

  readDocument: (id) =>
    ipcRenderer.invoke(IPC.readDocument, id) as Promise<IpcResult<ReferenceDocView>>,

  consultOracle: (request) =>
    ipcRenderer.invoke(IPC.consultOracle, request) as Promise<IpcResult<ConsultationView>>,

  describeEntityTypes: () =>
    ipcRenderer.invoke(IPC.describeEntityTypes) as Promise<IpcResult<EntityTypesView>>,

  startTrack: (request) =>
    ipcRenderer.invoke(IPC.startTrack, request) as Promise<IpcResult<EntityView>>,

  advanceTrack: (request) =>
    ipcRenderer.invoke(IPC.advanceTrack, request) as Promise<IpcResult<EntityView>>,

  setTrack: (request) =>
    ipcRenderer.invoke(IPC.setTrack, request) as Promise<IpcResult<EntityView>>,

  readPreferences: () =>
    ipcRenderer.invoke(IPC.readPreferences) as Promise<IpcResult<PreferencesView>>,

  setMotionPreference: (motion) =>
    ipcRenderer.invoke(IPC.setMotionPreference, motion) as Promise<IpcResult<PreferencesView>>,

  setThemePreference: (theme) =>
    ipcRenderer.invoke(IPC.setThemePreference, theme) as Promise<IpcResult<PreferencesView>>,
};

contextBridge.exposeInMainWorld('aetherForge', api);
