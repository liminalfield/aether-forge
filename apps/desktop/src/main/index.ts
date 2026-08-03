import { join } from 'node:path';

import { app, BrowserWindow, ipcMain, shell } from 'electron';

import { IPC } from '../shared/ipc';
import { openCampaignDatabase } from './db';

const isDev = !app.isPackaged;

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

function registerIpcHandlers(): void {
  ipcMain.handle(IPC.getAppVersion, () => app.getVersion());
}

void app.whenReady().then(() => {
  registerIpcHandlers();

  // Proves the native module and the migration path work in a packaged build;
  // the real campaign lifecycle arrives with the first feature milestone.
  const db = openCampaignDatabase(app.getPath('userData'));
  app.once('will-quit', () => db.close());

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
