import type {
  ApproveBdkFlowResult,
  AttendanceApprovalRequest,
  AttendanceApprovalResult,
  AttendanceRecordDetailResult,
  AttendanceRecordsResult,
  CookieList,
  IpcResult,
  NewSignAgainResult,
  VerifyCookiesResult,
} from './types';

export interface IElectronAPI {
  // Device & Cookie Management
  enableDeviceEmulation: (webContentsId: number, width?: number, height?: number) => void;
  startCookieMonitoring: (webContentsId: number) => void;
  saveCookies: (cookies: CookieList) => void;
  loadCookies: () => Promise<CookieList>;
  getCookies: (webContentsId: number) => Promise<CookieList>;
  clearCookies: (webContentsId: number) => Promise<IpcResult>;
  deleteCookie: (webContentsId: number, name: string, domain: string, path: string) => Promise<IpcResult>;
  deleteCookieFromFile: (name: string, domain: string, path: string) => Promise<IpcResult>;
  clearCookiesFile: () => Promise<IpcResult>;
  verifyCookies: (clearOnFailure?: boolean) => Promise<VerifyCookiesResult>;
  onCookiesUpdated: (callback: () => void) => void;

  // Business Logic
  getAttendanceRecords: (csrf: string, yearmo?: string) => Promise<AttendanceRecordsResult>;
  getAttendanceRecordByDate: (csrf: string, date: string) => Promise<AttendanceRecordDetailResult>;
  getApproveBdkFlow: (csrf: string, date: string) => Promise<ApproveBdkFlowResult>;
  newSignAgain: (csrf: string) => Promise<NewSignAgainResult>;
  startAttendanceApproval: (csrf: string, approval: AttendanceApprovalRequest) => Promise<AttendanceApprovalResult>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
