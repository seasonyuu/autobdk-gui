
export interface IElectronAPI {
  // Device & Cookie Management
  enableDeviceEmulation: (webContentsId: number, width?: number, height?: number) => void;
  startCookieMonitoring: (webContentsId: number) => void;
  saveCookies: (cookies: any[]) => void;
  loadCookies: () => Promise<any[]>;
  getCookies: (webContentsId: number) => Promise<any[]>;
  clearCookies: (webContentsId: number) => Promise<{ success: boolean; error?: string }>;
  deleteCookie: (webContentsId: number, name: string, domain: string, path: string) => Promise<{ success: boolean; error?: string }>;
  deleteCookieFromFile: (name: string, domain: string, path: string) => Promise<{ success: boolean; error?: string }>;
  clearCookiesFile: () => Promise<{ success: boolean; error?: string }>;
  verifyCookies: (clearOnFailure?: boolean) => Promise<{ success: boolean; data?: any; error?: string }>;
  onCookiesUpdated: (callback: () => void) => void;

  // Business Logic
  getAttendanceRecords: (csrf: string, yearmo?: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  getAttendanceRecordByDate: (csrf: string, date: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  getApproveBdkFlow: (csrf: string, date: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  newSignAgain: (csrf: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  startAttendanceApproval: (csrf: string, approval: any) => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
