import type { ApprovalItem } from '../../types';
import { AttendanceSituation } from '../../types';
import { parseTimestamp, formatDate, formatTime } from '../../utils/date';

const HOUR_START = 10;
const HOUR_END = 19;

/**
 * 考勤分析器
 * 负责分析考勤数据，找出需要补签的记录
 */
export class AttendanceAnalyzer {
  constructor(
    private csrf: string,
    private yearmo: string
  ) {}

  /**
   * 分析考勤数据，返回需要补签的项目列表
   */
  async analyze(): Promise<ApprovalItem[]> {
    const approvalList: ApprovalItem[] = [];

    // 1. 获取考勤记录列表
    const result = await (window as any).electronAPI?.getAttendanceRecords?.(
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
  private async analyzeRecord(record: any): Promise<ApprovalItem[]> {
    const items: ApprovalItem[] = [];
    const recordTime = record.time;

    // 获取该日期的详细打卡信息
    const dateStr = this.formatDateForAPI(recordTime);
    const detailResult = await (window as any).electronAPI?.getAttendanceRecordByDate?.(
      this.csrf,
      dateStr
    );

    if (!detailResult?.success || !detailResult.data?.signTimeList) {
      console.warn('Failed to get detail for date:', dateStr);
      return items;
    }

    const { signTimeList } = detailResult.data;

    let timeBegin: any = null;
    let timeEnd: any = null;

    for (const signTime of signTimeList) {
      if (signTime.rangeName === '上班') {
        timeBegin = signTime;
      } else if (signTime.rangeName === '下班') {
        timeEnd = signTime;
      }
    }

    // 获取已有的补签记录
    const bdkResult = await (window as any).electronAPI?.getApproveBdkFlow?.(
      this.csrf,
      `${recordTime}`
    );

    let bdkBegin: string | null = null;
    let bdkEnd: string | null = null;

    if (bdkResult?.success && bdkResult.data) {
      for (const approve of bdkResult.data) {
        const { hour } = parseTimestamp(approve.startDate);
        if (hour <= HOUR_START) {
          bdkBegin = formatTime(hour, parseTimestamp(approve.startDate).minute);
        } else if (hour >= HOUR_END) {
          bdkEnd = formatTime(hour, parseTimestamp(approve.startDate).minute);
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
        time: formatTime(HOUR_START, 0),
        clockType: timeBegin.clockAttribution,
        rangeId: timeBegin.rangeId,
        timestamp: recordTime,
        status: 'pending',
      });
    }

    // 检查是否需要补签下班
    if (!bdkEnd && (!timeEnd.clockTime || timeEnd.statusDesc)) {
      let hour = HOUR_END;
      let minute = 0;

      // 如果已经打卡上班且时间晚于下班时间，使用上班时间+1分钟
      if (timeBegin.clockTime) {
        const [beginHour, beginMinute] = timeBegin.clockTime.split(':').map(Number);
        if (beginHour >= HOUR_END) {
          hour = beginHour;
          minute = beginMinute + 1;
        }
      }

      items.push({
        date: formatDate(recordTime),
        time: formatTime(hour, minute),
        clockType: timeEnd.clockAttribution,
        rangeId: timeEnd.rangeId,
        timestamp: recordTime,
        status: 'pending',
      });
    }

    return items;
  }

  /**
   * 格式化日期为 API 需要的格式 (yyyyMMdd)
   */
  private formatDateForAPI(timestamp: number): string {
    const { year, month, day } = parseTimestamp(timestamp);
    return `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
  }
}
