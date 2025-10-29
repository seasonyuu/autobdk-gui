/**
 * 解析 Unix 时间戳为日期对象
 */
export function parseTimestamp(timestamp: number): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const date = new Date(timestamp * 1000);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
}

/**
 * 格式化日期为 MM-DD
 */
export function formatDate(timestamp: number): string {
  const { month, day } = parseTimestamp(timestamp);
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * 格式化时间为 HH:mm
 */
export function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * 计算相邻月份的 yearmo
 */
export function getAdjacentMonth(yearmo: string, offset: number): string {
  const year = parseInt(yearmo.substring(0, 4));
  const month = parseInt(yearmo.substring(4, 6));

  const date = new Date(year, month - 1 + offset, 1);
  const newYear = date.getFullYear();
  const newMonth = date.getMonth() + 1;

  return `${newYear}${String(newMonth).padStart(2, '0')}`;
}
