import { join } from 'node:path';

import type { EventLog } from '@aether-forge/core';
import { app, BrowserWindow, ipcMain, shell } from 'electron';

import { IPC } from '../shared/ipc';
import { openCampaignDatabase } from './db';
import { openEventLog } from './event-log';
import { countEvents, recordEntry } from './journal';
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

function registerIpcHandlers(log: EventLog): void {
  ipcMain.handle(IPC.getAppVersion, () => app.getVersion());
  ipcMain.handle(IPC.recordEntry, (_event, text: unknown) => recordEntry(log, text));
  ipcMain.handle(IPC.countEvents, () => countEvents(log));
}

void app.whenReady().then(() => {
  const db = openCampaignDatabase(app.getPath('userData'), ONLY_CAMPAIGN);
  app.once('will-quit', () => db.close());

  // The two unpredictable inputs to writing an event, supplied here because
  // this is the only layer allowed to reach for them.
  const log = openEventLog(db, ONLY_CAMPAIGN, {
    now: () => new Date().toISOString(),
    nextEventId: createUlidSource(),
  });

  registerIpcHandlers(log);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
