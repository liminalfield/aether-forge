import { join } from 'node:path';

import {
  createTranslatingLog,
  describeFailure,
  journal,
  openCampaign,
  type OpenCampaign,
  type Projection,
} from '@aether-forge/core';
import { app, BrowserWindow, ipcMain, shell } from 'electron';

import { IPC } from '../shared/ipc';
import { openCampaignDatabase } from './db';
import { declareEventTypes } from './event-types';
import { openEventLog } from './event-log';
import { correctEntry, readJournal, recordEntry } from './journal';
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
    backgroundColor: '#101216',
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

function registerIpcHandlers(campaign: OpenCampaign): void {
  ipcMain.handle(IPC.getAppVersion, () => app.getVersion());
  ipcMain.handle(IPC.readJournal, () => readJournal(campaign));
  ipcMain.handle(IPC.recordEntry, (_event, text: unknown) => recordEntry(campaign, text));
  ipcMain.handle(IPC.correctEntry, (_event, entryId: unknown, text: unknown) =>
    correctEntry(campaign, entryId, text),
  );
}

void app.whenReady().then(() => {
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
  const opened = openCampaign(log, { projections: [journal as Projection<unknown>] });
  if (!opened.ok) {
    // Nothing sensible can be shown for a campaign that cannot be read, and
    // carrying on would mean a window presenting an empty campaign as though
    // it were the truth.
    throw new Error(`this campaign could not be opened: ${describeFailure(opened.failure)}`);
  }

  registerIpcHandlers(opened.value);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
