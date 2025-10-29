import { escapeHtml } from '../utils/dom';

/**
 * 日历管理器
 * 负责日历的渲染和显示
 */
export class CalendarManager {
  constructor(private container: HTMLDivElement) {}

  /**
   * 渲染日历
   */
  render(attendanceData: any, onMonthChange: (offset: number) => void): void {
    if (!this.container || !attendanceData?.records) return;

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
        <button class="calendar-nav-btn" id="prev-month-btn">◀ 上月</button>
        <div class="calendar-title">
          <h3>${year}年 ${monthNames[month - 1]}</h3>
          <div class="calendar-period">${attendanceArchive.begin} - ${attendanceArchive.end}</div>
        </div>
        <button class="calendar-nav-btn" id="next-month-btn">下月 ▶</button>
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
      (r: any) => r.monthStatus === 0 || r.monthStatus === -1
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
    records.forEach((record: any) => {
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
          .filter((s: any) => s.statusDesc)
          .map((s: any) => s.statusDesc);
        if (statusDescList.length > 0) {
          statusText = `<div class="day-status">${escapeHtml(statusDescList.join(', '))}</div>`;
        }
      }

      calendarHTML += `
        <div class="${dayClass}" data-date="${date}">
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

    console.log('Calendar rendered');
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
    this.container.innerHTML = '';
  }
}
