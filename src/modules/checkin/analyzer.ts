import type { ApprovalItem, AttendanceRecordSummary, AttendanceSignTime, CheckinTimeSettings } from '../../types';
import { AttendanceSituation } from '../../types';
import { parseTimestamp, formatDate, formatTime } from '../../utils/date';
import { DEFAULT_CHECKIN_TIME_SETTINGS } from '../settings';


/**
 * 考勤分析器
 * 负责分析考勤数据，找出需要补签的记录
 */
export class AttendanceAnalyzer {
  constructor(
    private csrf: string,
    private yearmo: string,
    private timeSettings: CheckinTimeSettings = DEFAULT_CHECKIN_TIME_SETTINGS
  ) {}

  /**
   * 分析考勤数据，返回需要补签的项目列表
   */
  async analyze(): Promise<ApprovalItem[]> {
    const approvalList: ApprovalItem[] = [];

    // 1. 获取考勤记录列表
    const result = await window.electronAPI?.getAttendanceRecords?.(
      this.csrf,
      this.yearmo
    );

    if (!result?.success || !result.data?.records) {
      throw new Error(result?.error || '获取考勤记录失败');
    }

    const { records } = result.data;

    // 2. 分析每条异常记录
    for (const record of records) {
      if (record.situation !== AttendanceSituation.WARNING) {
        continue;
      }

      const items = await this.analyzeRecord(record);
      approvalList.push(...items);
    }

    return approvalList;
  }

  /**
   * 分析单条考勤记录
   */
  private async analyzeRecord(record: AttendanceRecordSummary): Promise<ApprovalItem[]> {
    const items: ApprovalItem[] = [];
    const recordTime = record.time;

    // 获取该日期的详细打卡信息
    const dateStr = this.formatDateForAPI(recordTime);
    const detailResult = await window.electronAPI?.getAttendanceRecordByDate?.(
      this.csrf,
      dateStr
    );

    if (!detailResult?.success || !detailResult.data?.signTimeList) {
      this.warnMalformedAttendanceDetail(dateStr, detailResult?.error || 'missing signTimeList');
      return items;
    }

    const { signTimeList } = detailResult.data;

    let timeBegin: AttendanceSignTime | null = null;
    let timeEnd: AttendanceSignTime | null = null;

    for (const signTime of signTimeList) {
      if (signTime.rangeName === '上班') {
        timeBegin = signTime;
      } else if (signTime.rangeName === '下班') {
        timeEnd = signTime;
      }
    }

    // 获取已有的补签记录
    const bdkResult = await window.electronAPI?.getApproveBdkFlow?.(
      this.csrf,
      `${recordTime}`
    );

    let bdkBegin: string | null = null;
    let bdkEnd: string | null = null;

    const { startTime, endTime } = this.getConfiguredTimes();
    const startMinutes = this.toMinutes(startTime);
    const endMinutes = this.toMinutes(endTime);

    if (bdkResult?.success && bdkResult.data) {
      for (const approve of bdkResult.data) {
        const { hour, minute } = parseTimestamp(approve.startDate);
        const approveMinutes = hour * 60 + minute;
        if (approveMinutes <= startMinutes) {
          bdkBegin = formatTime(hour, minute);
        } else if (approveMinutes >= endMinutes) {
          bdkEnd = formatTime(hour, minute);
        }
      }
    }

    if (!timeBegin || !timeEnd) {
      return items;
    }

    // 检查是否需要补签上班
    if (!bdkBegin && (!timeBegin.clockTime || timeBegin.statusDesc)) {
      items.push({
        date: formatDate(recordTime),
        time: startTime,
        clockType: timeBegin.clockAttribution,
        rangeId: timeBegin.rangeId,
        timestamp: recordTime,
        status: 'pending',
      });
    }

    // 检查是否需要补签下班
    if (!bdkEnd && (!timeEnd.clockTime || timeEnd.statusDesc)) {
      let approvalTime = endTime;

      // 如果已经打卡上班且时间晚于下班补签时间，使用上班时间+1分钟
      if (timeBegin.clockTime) {
        const beginMinutes = this.toMinutes(timeBegin.clockTime);
        if (beginMinutes >= endMinutes) {
          approvalTime = this.fromMinutes(Math.min(beginMinutes + 1, 23 * 60 + 59));
        }
      }

      items.push({
        date: formatDate(recordTime),
        time: approvalTime,
        clockType: timeEnd.clockAttribution,
        rangeId: timeEnd.rangeId,
        timestamp: recordTime,
        status: 'pending',
      });
    }

    return items;
  }

  /**
   * 记录考勤详情异常，避免把缺失数据误判为无需补签。
   */
  private warnMalformedAttendanceDetail(date: string, reason: string): void {
    console.warn('Malformed attendance detail response:', { date, reason });
  }

  private getConfiguredTimes(): CheckinTimeSettings {
    return {
      startTime: this.timeSettings.startTime,
      endTime: this.timeSettings.endTime,
    };
  }

  private toMinutes(value: string): number {
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  }

  private fromMinutes(value: number): string {
    const hour = Math.floor(value / 60);
    const minute = value % 60;
    return formatTime(hour, minute);
  }

  /**
   * 格式化日期为 API 需要的格式 (yyyyMMdd)
   */
  private formatDateForAPI(timestamp: number): string {
    const { year, month, day } = parseTimestamp(timestamp);
    return `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
  }
}
