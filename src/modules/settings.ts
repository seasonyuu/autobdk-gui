import type { CheckinTimeSettings } from '../types';

const STORAGE_KEY = 'autobdk.checkinTimeSettings.v1';

export const DEFAULT_CHECKIN_TIME_SETTINGS: CheckinTimeSettings = {
  startTime: '10:00',
  endTime: '19:00',
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class SettingsManager {
  loadCheckinTimeSettings(): CheckinTimeSettings {
    try {
      const rawValue = window.localStorage.getItem(STORAGE_KEY);
      if (!rawValue) return DEFAULT_CHECKIN_TIME_SETTINGS;

      const parsed = JSON.parse(rawValue) as Partial<CheckinTimeSettings>;
      return this.normalizeSettings(parsed);
    } catch (error) {
      console.warn('Failed to load check-in time settings, using defaults:', error);
      return DEFAULT_CHECKIN_TIME_SETTINGS;
    }
  }

  saveCheckinTimeSettings(settings: CheckinTimeSettings): CheckinTimeSettings {
    const normalized = this.normalizeSettings(settings);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  resetCheckinTimeSettings(): CheckinTimeSettings {
    window.localStorage.removeItem(STORAGE_KEY);
    return DEFAULT_CHECKIN_TIME_SETTINGS;
  }

  private normalizeSettings(settings: Partial<CheckinTimeSettings>): CheckinTimeSettings {
    const startTime = this.normalizeTime(settings.startTime, DEFAULT_CHECKIN_TIME_SETTINGS.startTime);
    const endTime = this.normalizeTime(settings.endTime, DEFAULT_CHECKIN_TIME_SETTINGS.endTime);

    if (this.toMinutes(startTime) >= this.toMinutes(endTime)) {
      throw new Error('上班补签时间必须早于下班补签时间');
    }

    return { startTime, endTime };
  }

  private normalizeTime(value: string | undefined, fallback: string): string {
    if (!value || !TIME_PATTERN.test(value)) return fallback;
    return value;
  }

  private toMinutes(value: string): number {
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  }
}
