// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  enableDeviceEmulation: (webContentsId: number, width?: number, height?: number) => {
    ipcRenderer.send('enable-device-emulation', webContentsId, width, height);
  },
  startCookieMonitoring: (webContentsId: number) => {
    ipcRenderer.send('start-cookie-monitoring', webContentsId);
  },
  saveCookies: (cookies: any[]) => {
    ipcRenderer.send('save-cookies', cookies);
  },
  loadCookies: () => {
    return ipcRenderer.invoke('load-cookies');
  },
  getCookies: (webContentsId: number) => {
    return ipcRenderer.invoke('get-cookies', webContentsId);
  },
  clearCookies: (webContentsId: number) => {
    return ipcRenderer.invoke('clear-cookies', webContentsId);
  },
  deleteCookie: (webContentsId: number, name: string, domain: string, path: string) => {
    return ipcRenderer.invoke('delete-cookie', webContentsId, name, domain, path);
  },
  deleteCookieFromFile: (name: string, domain: string, path: string) => {
    return ipcRenderer.invoke('delete-cookie-from-file', name, domain, path);
  },
  clearCookiesFile: () => {
    return ipcRenderer.invoke('clear-cookies-file');
  },
  verifyCookies: (clearOnFailure?: boolean) => {
    return ipcRenderer.invoke('verify-cookies', clearOnFailure);
  },
  onCookiesUpdated: (callback: () => void) => {
    ipcRenderer.on('cookies-updated', callback);
  },
  getAttendanceRecords: (csrf: string, yearmo?: string) => {
    return ipcRenderer.invoke('get-attendance-records', csrf, yearmo);
  },
  getAttendanceRecordByDate: (csrf: string, date: string) => {
    return ipcRenderer.invoke('get-attendance-record-by-date', csrf, date);
  },
  getApproveBdkFlow: (csrf: string, date: string) => {
    return ipcRenderer.invoke('get-approve-bdk-flow', csrf, date);
  },
  newSignAgain: (csrf: string) => {
    return ipcRenderer.invoke('new-sign-again', csrf);
  },
  startAttendanceApproval: (csrf: string, approval: any) => {
    return ipcRenderer.invoke('start-attendance-approval', csrf, approval);
  }
});
