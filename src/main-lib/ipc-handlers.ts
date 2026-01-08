import { ipcMain, webContents, session } from 'electron';
import { cookieStore } from './cookie-store';
import {
  common,
  getAttendanceRecordList,
  getAttendanceRecordByDate,
  getApproveBdkFlow,
  newSignAgain,
  startAttendanceApproval,
  IAttendanceApproval
} from '../api';

export function registerIpcHandlers() {
  // ==================== Device Emulation ====================
  
  ipcMain.on('enable-device-emulation', (event, webContentsId: number, width?: number, height?: number) => {
    try {
      const wc = webContents.fromId(webContentsId);
      if (wc) {
        const viewportWidth = width || 412;
        const viewportHeight = height || 600;

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

        console.log('Device emulation enabled via CDP', `(${viewportWidth}x${viewportHeight})`);
      }
    } catch (error) {
      console.error('Failed to enable device emulation:', error);
    }
  });

  // ==================== Cookie Management ====================

  ipcMain.on('save-cookies', async (event, cookies) => {
    cookieStore.save(cookies);
  });

  ipcMain.handle('load-cookies', async () => {
    return cookieStore.load();
  });

  ipcMain.on('start-cookie-monitoring', (event, webContentsId: number) => {
    try {
      const wc = webContents.fromId(webContentsId);
      if (wc) {
        const webviewSession = wc.session;

        webviewSession.cookies.addListener('changed', async (cookieEvent, cookie, cause, removed) => {
          const allCookies = await webviewSession.cookies.get({});
          
          if (cookieStore.handleCookiesChanged(allCookies)) {
            console.log('Cookies auto-saved:', allCookies.length, 'cookies');
            event.sender.send('cookies-updated');
          }
        });

        console.log('Cookie monitoring started for webContentsId:', webContentsId);
      }
    } catch (error) {
      console.error('Failed to start cookie monitoring:', error);
    }
  });

  ipcMain.handle('get-cookies', async (event, webContentsId: number) => {
    try {
      const wc = webContents.fromId(webContentsId);
      if (wc) {
        return await wc.session.cookies.get({});
      }
    } catch (error) {
      console.error('Failed to get cookies:', error);
    }
    return [];
  });

  ipcMain.handle('clear-cookies', async (event, webContentsId: number) => {
    try {
      const wc = webContents.fromId(webContentsId);
      if (wc) {
        await wc.session.clearStorageData({ storages: ['cookies'] });
        cookieStore.clearFile();
        return { success: true };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
    return { success: false, error: 'WebContents not found' };
  });

  ipcMain.handle('delete-cookie', async (event, webContentsId: number, name: string, domain: string, path: string) => {
    try {
      const wc = webContents.fromId(webContentsId);
      if (wc) {
        const url = `https://${domain}${path}`;
        await wc.session.cookies.remove(url, name);
        
        const allCookies = await wc.session.cookies.get({});
        cookieStore.save(allCookies);
        
        return { success: true };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
    return { success: false, error: 'WebContents not found' };
  });

  ipcMain.handle('delete-cookie-from-file', async (event, name: string, domain: string, path: string) => {
    try {
      // Delete from webview session
      const webviewSession = session.fromPartition('persist:mobile');
      const url = `https://${domain}${path}`;
      await webviewSession.cookies.remove(url, name);

      // Delete from file
      cookieStore.deleteFromFile(name, domain, path);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('clear-cookies-file', async () => {
    try {
      const webviewSession = session.fromPartition('persist:mobile');
      await webviewSession.clearStorageData({ storages: ['cookies'] });
      cookieStore.clearFile();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('verify-cookies', async (event, clearOnFailure: boolean = false) => {
    try {
      // 优先使用 WebView 实时 Session 中的 Cookie，避免文件被清空后拿不到最新登录态
      const webviewSession = session.fromPartition('persist:mobile');
      let cookies = await webviewSession.cookies.get({});

      // 若 session 中为空，回退到文件缓存（如应用重启后的场景）
      if (cookies.length === 0) {
        cookies = cookieStore.load();
      } else {
        // 与文件保持同步
        cookieStore.save(cookies);
      }

      if (cookies.length === 0) {
        return { success: false, error: 'No saved cookies found' };
      }

      const cookieString = cookies
        .map((cookie: any) => `${cookie.name}=${cookie.value}`)
        .join('; ');

      console.log('Verifying cookies with common API...', cookies.length, 'cookies');
      const result = await common(cookieString);

      if (result && 'redirect' in result) {
        console.log('Cookie verification failed: redirect detected');
        
        if (clearOnFailure) {
          cookieStore.clearFile();
          await webviewSession.clearStorageData({ storages: ['cookies'] });
        }

        return {
          success: false,
          error: 'Authentication failed' + (clearOnFailure ? ' - cookies cleared' : '')
        };
      }

      return { success: true, data: result };
    } catch (error) {
      console.error('Failed to verify cookies:', error);
      
      if (clearOnFailure) {
        cookieStore.clearFile();
        const webviewSession = session.fromPartition('persist:mobile');
        await webviewSession.clearStorageData({ storages: ['cookies'] });
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // ==================== Business Logic ====================

  ipcMain.handle('get-attendance-records', async (event, csrf: string, yearmo?: string) => {
    try {
      const cred = cookieStore.getCredentials(csrf);
      if (!cred) return { success: false, error: 'No saved cookies found' };

      console.log('Fetching attendance records...');
      const result = await getAttendanceRecordList(cred, yearmo || '');
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('get-attendance-record-by-date', async (event, csrf: string, date: string) => {
    try {
      const cred = cookieStore.getCredentials(csrf);
      if (!cred) return { success: false, error: 'No saved cookies found' };

      const result = await getAttendanceRecordByDate(cred, date);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('get-approve-bdk-flow', async (event, csrf: string, date: string) => {
    try {
      const cred = cookieStore.getCredentials(csrf);
      if (!cred) return { success: false, error: 'No saved cookies found' };

      const result = await getApproveBdkFlow(cred, date);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('new-sign-again', async (event, csrf: string) => {
    try {
      const cred = cookieStore.getCredentials(csrf);
      if (!cred) return { success: false, error: 'No saved cookies found' };

      const result = await newSignAgain(cred);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('start-attendance-approval', async (event, csrf: string, approval: IAttendanceApproval) => {
    try {
      const cred = cookieStore.getCredentials(csrf);
      if (!cred) return { success: false, error: 'No saved cookies found' };

      const errorMessage = await startAttendanceApproval(cred, approval);
      
      if (errorMessage) {
        return { success: false, error: errorMessage };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}
