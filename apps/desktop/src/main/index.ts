import { join } from 'node:path';

import {
  createTranslatingLog,
  describeFailure,
  entities,
  journal,
  openCampaign,
  suggestions,
  type OpenCampaign,
  type Projection,
  type TranslatingLog,
} from '@aether-forge/core';
import { glacialDark } from '@aether-forge/ui';
import { builtInThemes, isMotionPreference, MOTION_PREFERENCES } from '@aether-forge/ui';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';

import { IPC, type PreferencesView } from '../shared/ipc';
import { answerOffer } from './answer-offer';
import { describeChecks } from './checks';
import { changeEntity, createEntity, describeEntityTypes, readEntities } from './entities';
import { openCampaignDatabase } from './db';
import { declareEventTypes } from './event-types';
import { openEventLog } from './event-log';
import { correctEntry, readJournal, recordEntry } from './journal';
import {
  importPackageFromFile,
  type RegistryDirectories,
  type RegistryHolder,
} from './import-package';
import { consultOracle } from './consult';
import { searchOracles } from './oracles';
import { listPackages, openRegistry } from './packages';
import { loadSystems } from './systems';
import { isKnownTheme, readPreferences, writePreferences } from './preferences';
import { runCheck } from './run-check';
import { readTimeline } from './timeline';
import { advanceTrack, setTrack, startTrack } from './tracks';
import { createUlidSource } from './ulid';

const isDev = !app.isPackaged;

/**
 * Campaigns are not created or chosen yet, so there is exactly one, and it is
 * the file the bootstrap already opens. Choosing between campaigns is its own
 * piece of work.
 */
const ONLY_CAMPAIGN = 'default';

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 940,
    minHeight: 600,
    show: false,
    // The flash a person sees before first paint. It is the theme's own ground,
    // because a window that opens in a colour no theme has changes colour once
    // the renderer arrives. Follows the chosen theme when themes become
    // choosable.
    backgroundColor: glacialDark.ground.base,
    title: 'Aether Forge',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Security posture, from the first commit. Do not loosen these.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once('ready-to-show', () => window.show());

  // Any window.open or external link leaves the app rather than navigating it.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void window.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return window;
}

function registerIpcHandlers(
  campaign: OpenCampaign,
  log: TranslatingLog,
  userDataDir: string,
  holder: RegistryHolder,
  directories: RegistryDirectories,
): void {
  ipcMain.handle(IPC.listPackages, () => listPackages(holder.current));
  ipcMain.handle(IPC.importPackage, () =>
    importPackageFromFile(holder, directories, async () => {
      const picked = await dialog.showOpenDialog({
        title: 'Import a Datasworn file',
        filters: [{ name: 'Datasworn JSON', extensions: ['json'] }],
        properties: ['openFile'],
      });
      return picked.canceled ? undefined : picked.filePaths[0];
    }),
  );

  ipcMain.handle(IPC.getAppVersion, () => app.getVersion());
  ipcMain.handle(IPC.readJournal, () => readJournal(campaign));

  ipcMain.handle(IPC.readTimeline, () => {
    const events = log.read();
    if (!events.ok) {
      return {
        ok: false as const,
        failure: { kind: events.failure.kind, detail: describeFailure(events.failure) },
      };
    }

    return { ok: true as const, value: readTimeline(campaign, events.value) };
  });
  ipcMain.handle(IPC.recordEntry, (_event, text: unknown) => recordEntry(campaign, text));
  ipcMain.handle(IPC.correctEntry, (_event, entryId: unknown, text: unknown) =>
    correctEntry(campaign, entryId, text),
  );

  ipcMain.handle(IPC.readChecks, () => ({ ok: true as const, value: describeChecks(campaign) }));
  ipcMain.handle(IPC.runCheck, (_event, request: unknown) => runCheck(campaign, request));
  ipcMain.handle(IPC.answerOffer, (_event, request: unknown) => answerOffer(campaign, request));

  const nextEntityId = createUlidSource();
  ipcMain.handle(IPC.readEntities, () => readEntities(campaign));
  ipcMain.handle(IPC.createEntity, (_event, request: unknown) =>
    createEntity(campaign, nextEntityId, request),
  );
  ipcMain.handle(IPC.changeEntity, (_event, request: unknown) => changeEntity(campaign, request));

  ipcMain.handle(IPC.searchOracles, (_event, query: unknown) => searchOracles(holder, query));
  ipcMain.handle(IPC.consultOracle, (_event, request: unknown) =>
    consultOracle(campaign, holder, request),
  );

  ipcMain.handle(IPC.describeEntityTypes, () => ({
    ok: true as const,
    value: describeEntityTypes(),
  }));
  ipcMain.handle(IPC.startTrack, (_event, request: unknown) => startTrack(campaign, request));
  ipcMain.handle(IPC.advanceTrack, (_event, request: unknown) => advanceTrack(campaign, request));
  ipcMain.handle(IPC.setTrack, (_event, request: unknown) => setTrack(campaign, request));

  /** What is stored, plus what this build could offer instead. */
  const preferencesView = (): PreferencesView => ({
    ...readPreferences(userDataDir),
    themes: builtInThemes.map((theme) => theme.name),
  });

  ipcMain.handle(IPC.readPreferences, () => ({ ok: true as const, value: preferencesView() }));

  ipcMain.handle(IPC.setMotionPreference, (_event, motion: unknown) => {
    // Refused because it is not a value this build knows, which is a different
    // thing from disapproving of the choice. There is no wrong answer here,
    // only answers that are not one of the three.
    if (!isMotionPreference(motion)) {
      return {
        ok: false as const,
        failure: {
          kind: 'unknown-motion-preference',
          detail: `${String(motion)} is not one of ${MOTION_PREFERENCES.join(', ')}`,
        },
      };
    }

    try {
      writePreferences(userDataDir, { ...readPreferences(userDataDir), motion });
    } catch (cause) {
      return {
        ok: false as const,
        failure: { kind: 'storage-failed', detail: String(cause) },
      };
    }

    return { ok: true as const, value: preferencesView() };
  });

  ipcMain.handle(IPC.setThemePreference, (_event, theme: unknown) => {
    // Refused for the same reason a motion preference is: not a value this
    // build has, rather than a choice anybody disapproves of.
    if (!isKnownTheme(theme)) {
      return {
        ok: false as const,
        failure: {
          kind: 'unknown-theme',
          detail: `${String(theme)} is not one of ${builtInThemes.map((each) => each.name).join(', ')}`,
        },
      };
    }

    try {
      writePreferences(userDataDir, { ...readPreferences(userDataDir), theme });
    } catch (cause) {
      return {
        ok: false as const,
        failure: { kind: 'storage-failed', detail: String(cause) },
      };
    }

    return { ok: true as const, value: preferencesView() };
  });
}

void app.whenReady().then(async () => {
  const db = openCampaignDatabase(app.getPath('userData'), ONLY_CAMPAIGN);
  app.once('will-quit', () => db.close());

  // The two unpredictable inputs to writing an event, supplied here because
  // this is the only layer allowed to reach for them.
  const stored = openEventLog(db, ONLY_CAMPAIGN, {
    now: () => new Date().toISOString(),
    nextEventId: createUlidSource(),
  });

  // Everything above this line speaks the current shape of every event. Older
  // ones are brought up to date as they are read, and what is stored is left
  // exactly as it was written.
  const log = createTranslatingLog(stored, declareEventTypes());

  // From here the application holds the campaign, not the log. Appending and
  // the state worked out from it stay in step because they are the same
  // object; a log written behind the projections' back would leave them stale
  // and nothing would say so.
  const opened = openCampaign(log, {
    projections: [
      journal as Projection<unknown>,
      suggestions as Projection<unknown>,
      entities as Projection<unknown>,
    ],
  });
  if (!opened.ok) {
    // Nothing sensible can be shown for a campaign that cannot be read, and
    // carrying on would mean a window presenting an empty campaign as though
    // it were the truth.
    throw new Error(`this campaign could not be opened: ${describeFailure(opened.failure)}`);
  }

  // What content this machine holds. Bundled packages ride in the install's
  // resources; imported ones live in the application data directory. Read
  // once at startup; the import flow re-reads when it installs.
  const directories: RegistryDirectories = {
    bundled: app.isPackaged
      ? join(process.resourcesPath, 'content')
      : join(app.getAppPath(), 'resources', 'content'),
    imported: join(app.getPath('userData'), 'packages'),
  };
  const holder: RegistryHolder = { current: await openRegistry(directories) };

  // The modules receive their installed content at load, per contract §9.
  // An import mid-session re-reads the registry but not the systems; new
  // checks arrive on restart, which the import surface says.
  loadSystems(holder.current.packages);

  registerIpcHandlers(opened.value, log, app.getPath('userData'), holder, directories);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
