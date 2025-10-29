/**
 * 用户信息
 */
export interface UserInfo {
  companyName: string;
  employeeName: string;
  csrf: string;
}

/**
 * 补签项
 */
export interface ApprovalItem {
  date: string; // "10-15"
  time: string; // "10:00"
  clockType: number; // 1 = 上班, 2 = 下班
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

/**
 * 考勤记录状态
 */
export enum AttendanceSituation {
  NORMAL = 0,
  WARNING = -1,
}
