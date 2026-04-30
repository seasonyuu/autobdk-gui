// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';
import type { IElectronAPI } from './electron-env';

const invoke = <T>(channel: string, ...args: unknown[]): Promise<T> => {
  return ipcRenderer.invoke(channel, ...args) as Promise<T>;
};

const electronAPI: IElectronAPI = {
  enableDeviceEmulation: (webContentsId, width, height) => {
    ipcRenderer.send('enable-device-emulation', webContentsId, width, height);
  },
  startCookieMonitoring: (webContentsId) => {
    ipcRenderer.send('start-cookie-monitoring', webContentsId);
  },
  saveCookies: (cookies) => {
    ipcRenderer.send('save-cookies', cookies);
  },
  loadCookies: () => {
    return invoke('load-cookies');
  },
  getCookies: (webContentsId) => {
    return invoke('get-cookies', webContentsId);
  },
  clearCookies: (webContentsId) => {
    return invoke('clear-cookies', webContentsId);
  },
  deleteCookie: (webContentsId, name, domain, path) => {
    return invoke('delete-cookie', webContentsId, name, domain, path);
  },
  deleteCookieFromFile: (name, domain, path) => {
    return invoke('delete-cookie-from-file', name, domain, path);
  },
  clearCookiesFile: () => {
    return invoke('clear-cookies-file');
  },
  verifyCookies: (clearOnFailure) => {
    return invoke('verify-cookies', clearOnFailure);
  },
  onCookiesUpdated: (callback) => {
    ipcRenderer.on('cookies-updated', () => {
      callback();
    });
  },
  getAttendanceRecords: (csrf, yearmo) => {
    return invoke('get-attendance-records', csrf, yearmo);
  },
  getAttendanceRecordByDate: (csrf, date) => {
    return invoke('get-attendance-record-by-date', csrf, date);
  },
  getApproveBdkFlow: (csrf, date) => {
    return invoke('get-approve-bdk-flow', csrf, date);
  },
  newSignAgain: (csrf) => {
    return invoke('new-sign-again', csrf);
  },
  startAttendanceApproval: (csrf, approval) => {
    return invoke('start-attendance-approval', csrf, approval);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
