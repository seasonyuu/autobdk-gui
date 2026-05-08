import type { AttendanceRecordSummary, IAttendanceRecordList } from '../types';
import { escapeHtml } from '../utils/dom';
import { iconSvg } from '../utils/icons';

/**
 * 日历管理器
 * 负责日历的渲染和显示
 */
export class CalendarManager {
  private detailDialog: HTMLDivElement | null = null;
  private readonly closeDetailDialogOnEscape = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      this.hideDetailDialog();
    }
  };

  constructor(private container: HTMLDivElement) {}

  /**
   * 渲染日历
   */
  render(attendanceData: IAttendanceRecordList, onMonthChange: (offset: number) => void): void {
    if (!this.container || !attendanceData.records) return;

    const { records, attendanceArchive } = attendanceData;

    // Parse year and month from yearmo (e.g., "202511")
    const yearmo = attendanceArchive.yearmo;
    const year = parseInt(yearmo.substring(0, 4));
    const month = parseInt(yearmo.substring(4, 6));

    // Create calendar header
    const monthNames = [
      '一月',
      '二月',
      '三月',
      '四月',
      '五月',
      '六月',
      '七月',
      '八月',
      '九月',
      '十月',
      '十一月',
      '十二月',
    ];

    let calendarHTML = `
      <div class="calendar-header">
        <button class="calendar-nav-btn" id="prev-month-btn">${iconSvg('chevron-left')}<span>上月</span></button>
        <div class="calendar-title">
          <h3>${year}年 ${monthNames[month - 1]}</h3>
          <div class="calendar-period">${attendanceArchive.begin} - ${attendanceArchive.end}</div>
        </div>
        <button class="calendar-nav-btn" id="next-month-btn"><span>下月</span>${iconSvg('chevron-right')}</button>
      </div>
      <div class="calendar-weekdays">
        <div class="weekday">日</div>
        <div class="weekday">一</div>
        <div class="weekday">二</div>
        <div class="weekday">三</div>
        <div class="weekday">四</div>
        <div class="weekday">五</div>
        <div class="weekday">六</div>
      </div>
      <div class="calendar-days">
    `;

    // Find the first day to determine starting position
    const firstRecord = records.find(
      (record: AttendanceRecordSummary) => record.monthStatus === 0 || record.monthStatus === -1
    );
    if (!firstRecord) {
      this.container.innerHTML =
        '<div class="calendar-error">无法解析考勤数据</div>';
      return;
    }

    // Get first day of month from timestamp
    const firstDate = new Date(firstRecord.time * 1000);
    const firstDayOfMonth = new Date(
      firstDate.getFullYear(),
      firstDate.getMonth(),
      1
    );
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday

    // Add empty cells for days before the month starts
    for (let i = 0; i < startDayOfWeek; i++) {
      calendarHTML += '<div class="calendar-day empty"></div>';
    }

    // Render each day
    records.forEach((record: AttendanceRecordSummary) => {
      // Skip days from previous/next month
      if (record.monthStatus === -1 || record.monthStatus === 1) {
        return;
      }

      const date = record.date;
      const isToday = record.isToday === 1;
      const isWorkday = record.isWorkday === 1;
      const situation = record.situation; // 0 = normal, -1 = abnormal
      const lunarShow = record.lunarShow || '';

      let dayClass = 'calendar-day';
      if (isToday) dayClass += ' today';
      if (!isWorkday) dayClass += ' weekend';
      if (situation === -1) dayClass += ' abnormal';

      let statusText = '';
      if (record.detailInfo?.signTimeList) {
        const statusDescList = record.detailInfo.signTimeList
          .filter((signTime) => signTime.statusDesc)
          .map((signTime) => signTime.statusDesc);
        if (statusDescList.length > 0) {
          const statusSummary = statusDescList.join(', ');
          const escapedStatusSummary = escapeHtml(statusSummary);
          statusText = `<div class="day-status" title="${escapedStatusSummary}">${escapedStatusSummary}</div>`;
        }
      }

      calendarHTML += `
        <div class="${dayClass}" data-date="${date}" role="button" tabindex="0" aria-label="查看 ${date} 日考勤详情">
          <div class="day-number">${date}</div>
          ${lunarShow ? `<div class="day-lunar">${escapeHtml(lunarShow)}</div>` : ''}
          ${statusText}
        </div>
      `;
    });

    calendarHTML += '</div>';

    this.container.innerHTML = calendarHTML;

    // Add event listeners for navigation buttons
    const prevBtn = document.getElementById('prev-month-btn') as HTMLButtonElement;
    const nextBtn = document.getElementById('next-month-btn') as HTMLButtonElement;

    if (prevBtn) {
      prevBtn.addEventListener('click', () => onMonthChange(-1));
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => onMonthChange(1));
    }

    this.container.querySelectorAll<HTMLElement>('.calendar-day:not(.empty)').forEach((dayEl) => {
      const day = Number(dayEl.dataset.date);
      const record = records.find((item) => item.date === day && item.monthStatus === 0);
      if (!record) return;

      dayEl.addEventListener('click', () => this.showDetailDialog(record));
      dayEl.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;

        event.preventDefault();
        this.showDetailDialog(record);
      });
    });

    console.log('Calendar rendered');
  }

  /**
   * 显示日期详情对话框
   */
  private showDetailDialog(record: AttendanceRecordSummary): void {
    const dialog = this.ensureDetailDialog();
    dialog.innerHTML = this.renderDetailDialog(record);
    dialog.classList.remove('hidden');

    const closeBtn = dialog.querySelector<HTMLButtonElement>('.calendar-detail-close');
    closeBtn?.addEventListener('click', () => this.hideDetailDialog());
    closeBtn?.focus();

    document.addEventListener('keydown', this.closeDetailDialogOnEscape);
  }

  private hideDetailDialog(): void {
    this.detailDialog?.classList.add('hidden');
    document.removeEventListener('keydown', this.closeDetailDialogOnEscape);
  }

  private ensureDetailDialog(): HTMLDivElement {
    if (this.detailDialog) return this.detailDialog;

    const dialog = document.createElement('div');
    dialog.className = 'dialog-overlay calendar-detail-overlay hidden';
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) {
        this.hideDetailDialog();
      }
    });

    document.body.appendChild(dialog);
    this.detailDialog = dialog;
    return dialog;
  }

  private renderDetailDialog(record: AttendanceRecordSummary): string {
    const recordDate = new Date(record.time * 1000);
    const dateTitle = `${recordDate.getFullYear()}年${recordDate.getMonth() + 1}月${record.date}日`;
    const workdayText = record.isWorkday === 1 ? '工作日' : '休息日';
    const situationText = record.situation === -1 ? '考勤异常' : '考勤正常';
    const situationClass = record.situation === -1 ? 'is-warning' : 'is-normal';
    const signTimeList = record.detailInfo?.signTimeList || [];
    const abnormalMessages = signTimeList
      .map((item) => item.statusDesc)
      .filter((statusDesc) => statusDesc);

    const signRows = signTimeList.length > 0
      ? signTimeList
        .map((item) => {
          const statusDesc = item.statusDesc || '正常';
          const rowClass = item.statusDesc ? 'has-warning' : 'is-normal';

          return `
            <div class="calendar-detail-record ${rowClass}">
              <div class="calendar-detail-record-main">
                <span class="calendar-detail-record-type">${escapeHtml(item.rangeName || AttendanceClockType[item.clockAttribution])}</span>
                <span class="calendar-detail-record-time">${escapeHtml(item.clockTime || '--:--')}</span>
              </div>
              <div class="calendar-detail-record-status">${escapeHtml(statusDesc)}</div>
            </div>
          `;
        })
        .join('')
      : `
        <div class="calendar-detail-empty">
          ${iconSvg('clock')}
          <span>暂无打卡明细</span>
        </div>
      `;

    const abnormalSummary = abnormalMessages.length > 0
      ? `<div class="calendar-detail-alert">${iconSvg('alert-circle')}<span>${escapeHtml(abnormalMessages.join('、'))}</span></div>`
      : '';

    return `
      <div class="dialog-container calendar-detail-container" role="dialog" aria-modal="true" aria-labelledby="calendar-detail-title">
        <div class="dialog-header calendar-detail-header">
          <div>
            <h3 id="calendar-detail-title">${escapeHtml(dateTitle)}</h3>
            <div class="calendar-detail-subtitle">${escapeHtml(record.lunarShow || '无农历信息')}</div>
          </div>
          <button class="dialog-close-btn calendar-detail-close" aria-label="关闭日期详情">${iconSvg('x')}</button>
        </div>
        <div class="dialog-body calendar-detail-body">
          <div class="calendar-detail-badges">
            <span class="calendar-detail-badge">${escapeHtml(workdayText)}</span>
            <span class="calendar-detail-badge ${situationClass}">${escapeHtml(situationText)}</span>
            ${record.isToday === 1 ? '<span class="calendar-detail-badge is-today">今天</span>' : ''}
          </div>
          ${abnormalSummary}
          <div class="calendar-detail-section-title">打卡明细</div>
          <div class="calendar-detail-records">
            ${signRows}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 显示加载状态
   */
  showLoading(): void {
    this.container.innerHTML = '<div class="calendar-loading">加载中...</div>';
  }

  /**
   * 显示错误信息
   */
  showError(message: string): void {
    this.container.innerHTML = `
      <div class="calendar-error">
        <p>无法获取考勤记录</p>
        <p class="error-detail">${escapeHtml(message)}</p>
      </div>
    `;
  }

  /**
   * 清空日历
   */
  clear(): void {
    this.hideDetailDialog();
    this.container.innerHTML = '';
  }
}
