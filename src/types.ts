import type { Cookie } from 'electron';

/**
 * IPC result envelope shared by preload, renderer, and IPC handlers.
 */
export type IpcResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export type ElectronCookie = Cookie;
export type CookieList = ElectronCookie[];

/**
 * 用户信息
 */
export interface UserInfo {
  companyName: string;
  employeeName: string;
  csrf: string;
}

export interface ICommon extends UserInfo {
  redirect?: string;
}

/**
 * 补签项
 */
export interface ApprovalItem {
  date: string; // "10-15"
  time: string; // "10:00"
  clockType: AttendanceClockType; // 1 = 上班, 2 = 下班
  rangeId: string;
  timestamp: number; // Unix timestamp
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
}

/**
 * 考勤打卡类型枚举
 */
export enum AttendanceClockType {
  上班 = 1,
  下班 = 2,
}

export enum AttendanceRecordMonthStatus {
  CURRENT = 0,
  NOT_CURRENT = -1,
}

/**
 * 考勤记录状态
 */
export enum AttendanceSituation {
  NORMAL = 0,
  WARNING = -1,
}

export interface IAttendanceRecordList {
  attandanceArchive: {
    begin: string;
    end: string;
    yearmo: string;
  };
  attendanceStatistics: {
    absentNum: number;
    lateNum: number;
    leaveEarlyNum: number;
    leaveOrOut: number;
    noWorkdayNum: number;
  };
  bdkUrl: string;
  isShowClockTime: boolean;
  records: AttendanceRecordSummary[];
  schedulingType: number;
  showClockTime: boolean;
}

export interface AttendanceRecordSummary {
  clockName: string | null;
  clockSettingId: number;
  containsData: number;
  date: number;
  detailInfo: null;
  isClocking: number;
  isToday: number;
  isWorkday: number;
  lunarShow: string | null;
  monthStatus: AttendanceRecordMonthStatus;
  situation: AttendanceSituation;
  time: number;
}

export interface IAttendanceRecord {
  bdkErrorMessage: null;
  bdkStatus: number;
  isFinish: number;
  isShowClockTime: number;
  signTimeList: AttendanceSignTime[];
  situationDesc: null;
  timeRanges: {
    startingTime: string; // "09:00"
    closingTime: string;
  }[];
}

export interface AttendanceSignTime {
  clockAttribution: AttendanceClockType;
  clockTime: string; // "12:45"
  rangeId: string;
  rangeName: keyof typeof AttendanceClockType;
  statusDesc: string; // 空字符串时表示没异常
}

export interface IApproveBdkFlow {
  flowSid: string;
  flowTypeName: string;
  isFinish: number;
  startDate: number; // 1630407600
}

export interface INewSignAgain {
  departmentList: {
    departmentId: string;
    departmentName: string;
  }[];
  flowSettingId: number;
  flow_type: number; // 6
  flow_type_desc: string; // "补卡"
}

export interface IAttendanceApproval {
  flow_type: number;
  flowSettingId: number;
  departmentId: string;
  date: string; // "1630425600"
  start_date: string; // "2021-09-01 10:00"
  timeRangeId: string;
  bdkDate: string; // "2021-09-01"
  clockType: AttendanceClockType;
}

export type AttendanceApprovalRequest = IAttendanceApproval;
export type VerifyCookiesResult = IpcResult<ICommon>;
export type AttendanceRecordsResult = IpcResult<IAttendanceRecordList>;
export type AttendanceRecordDetailResult = IpcResult<IAttendanceRecord>;
export type ApproveBdkFlowResult = IpcResult<IApproveBdkFlow[]>;
export type NewSignAgainResult = IpcResult<INewSignAgain>;
export type AttendanceApprovalResult = IpcResult;
