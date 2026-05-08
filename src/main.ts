import { app, BrowserWindow, Menu } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { registerIpcHandlers } from './main-lib/ipc-handlers';
import { cookieStore } from './main-lib/cookie-store';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const isDev = process.env.NODE_ENV === 'development';
const rendererDevServerUrl = process.env.VITE_DEV_SERVER_URL;

// Register all IPC handlers
registerIpcHandlers();

const createWindow = async () => {
  Menu.setApplicationMenu(null);

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../assets/icons/512x512.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      webviewTag: true,
    },
  });

  // Restore cookies from file when app starts
  await cookieStore.restoreToSession();

  // and load the index.html of the app.
  if (isDev && rendererDevServerUrl) {
    mainWindow.loadURL(rendererDevServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
