import { app, BrowserWindow, session, ipcMain, webContents } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';
import { electron } from 'node:process';
import {
  common,
  getAttendanceRecordList,
  getAttendanceRecordByDate,
  getApproveBdkFlow,
  newSignAgain,
  startAttendanceApproval,
  ICredential,
  IAttendanceApproval
} from './api';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Cookie storage path
const COOKIES_FILE = path.join(app.getPath('userData'), 'webview-cookies.json');

// Handle device emulation requests from renderer
ipcMain.on('enable-device-emulation', (event, webContentsId: number, width?: number, height?: number) => {
  try {
    const wc = webContents.fromId(webContentsId);
    if (wc) {
      // Use provided dimensions or default to 412x600
      const viewportWidth = width || 412;
      const viewportHeight = height || 600;

      // Enable Chrome DevTools Protocol for device emulation
      if (!wc.debugger.isAttached()) {
        wc.debugger.attach('1.3');
      }

      wc.debugger.sendCommand('Emulation.setDeviceMetricsOverride', {
        width: viewportWidth,
        height: viewportHeight,
        deviceScaleFactor: 2.625,
        mobile: true,
        screenWidth: viewportWidth,
        screenHeight: viewportHeight,
      });

      wc.debugger.sendCommand('Emulation.setTouchEmulationEnabled', {
        enabled: true,
        maxTouchPoints: 5,
      });

      console.log('Device emulation enabled via CDP for webContentsId:', webContentsId, `(${viewportWidth}x${viewportHeight})`);
    }
  } catch (error) {
    console.error('Failed to enable device emulation:', error);
  }
});

// Handle cookie save requests
ipcMain.on('save-cookies', async (event, cookies) => {
  try {
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2), 'utf-8');
    console.log('Cookies saved to:', COOKIES_FILE);
  } catch (error) {
    console.error('Failed to save cookies:', error);
  }
});

// Handle cookie load requests
ipcMain.handle('load-cookies', async () => {
  try {
    if (fs.existsSync(COOKIES_FILE)) {
      const data = fs.readFileSync(COOKIES_FILE, 'utf-8');
      const cookies = JSON.parse(data);
      console.log('Cookies loaded from:', COOKIES_FILE);
      console.log('cookies', JSON.stringify(cookies));
      return cookies;
    }
  } catch (error) {
    console.error('Failed to load cookies:', error);
  }
  return [];
});

// Store the last cookies hash to detect real changes
let lastCookiesHash = '';

function getCookiesHash(cookies: any[]): string {
  // Create a hash of cookie values to detect real changes
  return cookies
    .map(c => `${c.name}=${c.value}`)
    .sort()
    .join('|');
}

// Monitor webview session cookies
ipcMain.on('start-cookie-monitoring', (event, webContentsId: number) => {
  try {
    const wc = webContents.fromId(webContentsId);
    if (wc) {
      const webviewSession = wc.session;

      // Listen to cookie changes
      webviewSession.cookies.addListener('changed', async (cookieEvent, cookie, cause, removed) => {
        console.log(`Cookie ${removed ? 'removed' : 'changed'}:`, cookie.name, cause);

        // Get all cookies and save them
        const allCookies = await webviewSession.cookies.get({});
        const currentHash = getCookiesHash(allCookies);

        // Only save and notify if cookies actually changed
        if (currentHash !== lastCookiesHash) {
          fs.writeFileSync(COOKIES_FILE, JSON.stringify(allCookies, null, 2), 'utf-8');
          console.log('Cookies auto-saved:', allCookies.length, 'cookies');

          lastCookiesHash = currentHash;

          // Notify renderer process that cookies have been updated
          event.sender.send('cookies-updated');
          console.log('Cookies-updated event sent to renderer');
        } else {
          console.log('Cookie change detected but values unchanged, skipping notification');
        }
      });

      console.log('Cookie monitoring started for webContentsId:', webContentsId);
    }
  } catch (error) {
    console.error('Failed to start cookie monitoring:', error);
  }
});

// Get cookies from webview session
ipcMain.handle('get-cookies', async (event, webContentsId: number) => {
  try {
    const wc = webContents.fromId(webContentsId);
    if (wc) {
      const cookies = await wc.session.cookies.get({});
      console.log('Retrieved', cookies.length, 'cookies');
      return cookies;
    }
  } catch (error) {
    console.error('Failed to get cookies:', error);
  }
  return [];
});

// Clear cookies from webview session and file
ipcMain.handle('clear-cookies', async (event, webContentsId: number) => {
  try {
    const wc = webContents.fromId(webContentsId);
    if (wc) {
      // Clear session cookies
      await wc.session.clearStorageData({
        storages: ['cookies']
      });
      console.log('Session cookies cleared');

      // Delete cookie file
      if (fs.existsSync(COOKIES_FILE)) {
        fs.unlinkSync(COOKIES_FILE);
        console.log('Cookie file deleted');
      }

      return { success: true };
    }
  } catch (error) {
    console.error('Failed to clear cookies:', error);
    return { success: false, error: error.message };
  }
  return { success: false, error: 'WebContents not found' };
});

// Delete single cookie
ipcMain.handle('delete-cookie', async (event, webContentsId: number, name: string, domain: string, path: string) => {
  try {
    const wc = webContents.fromId(webContentsId);
    if (wc) {
      // Construct URL for cookie deletion
      const url = `https://${domain}${path}`;
      await wc.session.cookies.remove(url, name);
      console.log(`Cookie deleted: ${name} from ${domain}${path}`);

      // Update saved cookies file
      const allCookies = await wc.session.cookies.get({});
      fs.writeFileSync(COOKIES_FILE, JSON.stringify(allCookies, null, 2), 'utf-8');

      return { success: true };
    }
  } catch (error) {
    console.error('Failed to delete cookie:', error);
    return { success: false, error: error.message };
  }
  return { success: false, error: 'WebContents not found' };
});

// Delete cookie from file and webview session
ipcMain.handle('delete-cookie-from-file', async (event, name: string, domain: string, path: string) => {
  try {
    // Delete from webview session
    const webviewSession = session.fromPartition('persist:mobile');
    const url = `https://${domain}${path}`;
    await webviewSession.cookies.remove(url, name);
    console.log(`Cookie deleted from session: ${name} from ${domain}${path}`);

    // Delete from file
    if (!fs.existsSync(COOKIES_FILE)) {
      return { success: false, error: 'Cookie file not found' };
    }

    const data = fs.readFileSync(COOKIES_FILE, 'utf-8');
    const cookies = JSON.parse(data);

    // Filter out the cookie to delete
    const updatedCookies = cookies.filter((cookie: any) =>
      !(cookie.name === name && cookie.domain === domain && cookie.path === path)
    );

    // Save updated cookies back to file
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(updatedCookies, null, 2), 'utf-8');
    console.log(`Cookie deleted from file: ${name} from ${domain}${path}`);

    return { success: true };
  } catch (error) {
    console.error('Failed to delete cookie:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Clear cookies file and webview session
ipcMain.handle('clear-cookies-file', async () => {
  try {
    // Clear webview session cookies
    const webviewSession = session.fromPartition('persist:mobile');
    await webviewSession.clearStorageData({
      storages: ['cookies']
    });
    console.log('WebView session cookies cleared');

    // Delete cookie file
    if (fs.existsSync(COOKIES_FILE)) {
      fs.unlinkSync(COOKIES_FILE);
      console.log('Cookie file deleted');
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to clear cookies:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Verify stored cookies by calling common API
ipcMain.handle('verify-cookies', async (event, clearOnFailure: boolean = false) => {
  try {
    if (!fs.existsSync(COOKIES_FILE)) {
      console.log('No saved cookies found');
      return { success: false, error: 'No saved cookies found' };
    }

    const data = fs.readFileSync(COOKIES_FILE, 'utf-8');
    const savedCookies = JSON.parse(data);

    // Convert Electron cookie format to HTTP Cookie header string
    const cookieString = savedCookies
      .map((cookie: any) => `${cookie.name}=${cookie.value}`)
      .join('; ');

    console.log('Verifying cookies with common API...');

    // Call the common API
    const result = await common(cookieString);

    console.log('Common API result:', result);

    // Check if result contains redirect field, indicating failure
    if (result && 'redirect' in result) {
      console.log('Cookie verification failed: redirect detected');

      // Only delete the cookie file if clearOnFailure is true (startup only)
      if (clearOnFailure && fs.existsSync(COOKIES_FILE)) {
        try {
          fs.unlinkSync(COOKIES_FILE);
          console.log('Invalid cookie file deleted (startup verification)');
        } catch (unlinkError) {
          console.error('Failed to delete cookie file:', unlinkError);
        }
      }

      return {
        success: false,
        error: 'Authentication failed' + (clearOnFailure ? ' - cookies cleared' : '')
      };
    }

    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('Failed to verify cookies:', error);

    // Only clear cookies on network/other errors if clearOnFailure is true (startup only)
    if (clearOnFailure && fs.existsSync(COOKIES_FILE)) {
      try {
        fs.unlinkSync(COOKIES_FILE);
        console.log('Cookie file deleted due to verification error (startup verification)');
      } catch (unlinkError) {
        console.error('Failed to delete cookie file:', unlinkError);
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
});

// Helper function to get credentials
function getCredentials(csrf: string): ICredential | null {
  try {
    if (!fs.existsSync(COOKIES_FILE)) {
      console.log('No saved cookies found');
      return null;
    }

    const data = fs.readFileSync(COOKIES_FILE, 'utf-8');
    const savedCookies = JSON.parse(data);

    // Convert Electron cookie format to HTTP Cookie header string
    const cookieString = savedCookies
      .map((cookie: any) => `${cookie.name}=${cookie.value}`)
      .join('; ');

    return {
      'Cookie': cookieString,
      'X-CSRF-TOKEN': csrf,
    };
  } catch (error) {
    console.error('Failed to get credentials:', error);
    return null;
  }
}

// Get attendance record list
ipcMain.handle('get-attendance-records', async (event, csrf: string, yearmo?: string) => {
  try {
    const cred = getCredentials(csrf);
    if (!cred) {
      return { success: false, error: 'No saved cookies found' };
    }

    console.log('Fetching attendance records...');
    const result = await getAttendanceRecordList(cred, yearmo || '');

    console.log('Attendance records fetched:', result.records?.length || 0, 'records');
    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('Failed to get attendance records:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
});

// Get attendance record by date
ipcMain.handle('get-attendance-record-by-date', async (event, csrf: string, date: string) => {
  try {
    const cred = getCredentials(csrf);
    if (!cred) {
      return { success: false, error: 'No saved cookies found' };
    }

    console.log('Fetching attendance record for date:', date);
    const result = await getAttendanceRecordByDate(cred, date);

    console.log('Attendance record fetched for date:', date);
    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('Failed to get attendance record by date:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
});

// Get approve BDK flow
ipcMain.handle('get-approve-bdk-flow', async (event, csrf: string, date: string) => {
  try {
    const cred = getCredentials(csrf);
    if (!cred) {
      return { success: false, error: 'No saved cookies found' };
    }

    console.log('Fetching BDK flow for date:', date);
    const result = await getApproveBdkFlow(cred, date);

    console.log('BDK flow fetched:', result.length, 'items');
    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('Failed to get BDK flow:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
});

// New sign again (get flow config)
ipcMain.handle('new-sign-again', async (event, csrf: string) => {
  try {
    const cred = getCredentials(csrf);
    if (!cred) {
      return { success: false, error: 'No saved cookies found' };
    }

    console.log('Getting new sign again flow config...');
    const result = await newSignAgain(cred);

    console.log('Sign again flow config fetched');
    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('Failed to get sign again config:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
});

// Start attendance approval
ipcMain.handle('start-attendance-approval', async (event, csrf: string, approval: IAttendanceApproval) => {
  try {
    const cred = getCredentials(csrf);
    if (!cred) {
      return { success: false, error: 'No saved cookies found' };
    }

    console.log('Starting attendance approval:', approval);
    const errorMessage = await startAttendanceApproval(cred, approval);

    if (errorMessage) {
      console.log('Attendance approval failed:', errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }

    console.log('Attendance approval succeeded');
    return {
      success: true
    };
  } catch (error) {
    console.error('Failed to start attendance approval:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
});

const createWindow = async () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(__dirname, '../assets/icons/512x512.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,
    },
  });

  // Restore cookies from file when app starts
  try {
    if (fs.existsSync(COOKIES_FILE)) {
      const data = fs.readFileSync(COOKIES_FILE, 'utf-8');
      console.log('Restoring cookies from file', data);
      const savedCookies = JSON.parse(data);
      const webviewSession = session.fromPartition('persist:mobile');

      for (const cookie of savedCookies) {
        if (cookie.domain.startsWith('.')) {
          // Remove leading dot for Electron compatibility
          cookie.domain = cookie.domain.substring(1);
        }
        // Remove read-only properties
        const { hostOnly, session: isSession, ...cookieDetails } = cookie;
        try {
          await webviewSession.cookies.set({
            url: `https://${cookie.domain}${cookie.path}`,
            ...cookieDetails
          });
        } catch (err) {
          console.warn('Failed to restore cookie:', cookie.name, err);
        }
      }
      console.log('Restored', savedCookies.length, 'cookies');
    }
  } catch (error) {
    console.error('Failed to restore cookies:', error);
  }

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
