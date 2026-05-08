/**
 * Main renderer process entry point
 */

import './index.css';
import { AuthManager } from './modules/auth';
import { CalendarManager } from './modules/calendar';
import { WebViewManager } from './modules/webview';
import { CookieManager } from './modules/cookies';
import { CheckinManager } from './modules/checkin';
import { SettingsManager } from './modules/settings';
import { getAdjacentMonth } from './utils/date';
import { toggleDropdown, closeAllDropdowns } from './utils/dom';

console.log('👋 This message is being logged by "renderer.ts", included via Vite');

// ==================== DOM Elements ====================

const webviewContainer = document.getElementById('webview-container') as HTMLDivElement;
const leftContent = document.querySelector('.left-content') as HTMLDivElement;
const calendarContainer = document.getElementById('calendar-container') as HTMLDivElement;

// Top bar elements
const userMenuBtn = document.getElementById('user-menu-btn') as HTMLButtonElement;
const userDisplayName = document.getElementById('user-display-name') as HTMLSpanElement;
const userDropdown = document.getElementById('user-dropdown') as HTMLDivElement;
const dropdownCompany = document.getElementById('dropdown-company') as HTMLSpanElement;
const dropdownEmployee = document.getElementById('dropdown-employee') as HTMLSpanElement;
const dropdownCsrf = document.getElementById('dropdown-csrf') as HTMLDivElement;

// Settings menu elements
const settingsMenuBtn = document.getElementById('settings-menu-btn') as HTMLButtonElement;
const settingsDropdown = document.getElementById('settings-dropdown') as HTMLDivElement;
const checkinSettingsMenuItem = document.getElementById('checkin-settings-menu-item') as HTMLButtonElement;
const viewCookiesMenuItem = document.getElementById('view-cookies-menu-item') as HTMLButtonElement;
const openLoginMenuItem = document.getElementById('open-login-menu-item') as HTMLButtonElement;
const clearCookiesMenuItem = document.getElementById('clear-cookies-menu-item') as HTMLButtonElement;

// Cookie dialog elements
const cookieDialog = document.getElementById('cookie-dialog') as HTMLDivElement;
const cookieDialogDisplay = document.getElementById('cookie-dialog-display') as HTMLDivElement;
const closeDialogBtn = document.getElementById('close-dialog-btn') as HTMLButtonElement;

// Check-in settings dialog elements
const checkinSettingsDialog = document.getElementById('checkin-settings-dialog') as HTMLDivElement;
const checkinSettingsCloseBtn = document.getElementById('checkin-settings-close-btn') as HTMLButtonElement;
const checkinStartTimeInput = document.getElementById('checkin-start-time-input') as HTMLInputElement;
const checkinEndTimeInput = document.getElementById('checkin-end-time-input') as HTMLInputElement;
const checkinSettingsMessage = document.getElementById('checkin-settings-message') as HTMLDivElement;
const checkinSettingsResetBtn = document.getElementById('checkin-settings-reset-btn') as HTMLButtonElement;
const checkinSettingsSaveBtn = document.getElementById('checkin-settings-save-btn') as HTMLButtonElement;

// Quick check-in elements
const quickCheckinFab = document.getElementById('quick-checkin-fab') as HTMLButtonElement;
const checkinDialog = document.getElementById('checkin-dialog') as HTMLDivElement;
const checkinDialogTitle = document.getElementById('checkin-dialog-title') as HTMLHeadingElement;
const checkinDialogContent = document.getElementById('checkin-dialog-content') as HTMLDivElement;
const checkinDialogCloseBtn = document.getElementById('checkin-dialog-close-btn') as HTMLButtonElement;

// ==================== Initialize Managers ====================

const authManager = new AuthManager();
const calendarManager = new CalendarManager(calendarContainer);
const webviewManager = new WebViewManager(webviewContainer, leftContent, quickCheckinFab);
const cookieManager = new CookieManager();
const settingsManager = new SettingsManager();
let hasLoginPromptShown = false;

// ==================== Helper Functions ====================

/**
 * Load attendance records for a specific month offset
 */
async function loadAttendanceForMonth(offset: number): Promise<void> {
  const csrf = authManager.getCsrf();
  const currentYearmo = authManager.getYearmo();

  if (!csrf || !currentYearmo) {
    console.error('Missing csrf or yearmo');
    return;
  }

  const targetYearmo = getAdjacentMonth(currentYearmo, offset);
  console.log(`Loading attendance for ${targetYearmo}...`);

  calendarManager.showLoading();

  try {
    const result = await window.electronAPI?.getAttendanceRecords?.(csrf, targetYearmo);

    if (result?.success && result.data) {
      console.log('Attendance records fetched successfully');
      authManager.setYearmo(result.data.attendanceArchive.yearmo);
      calendarManager.render(result.data, loadAttendanceForMonth);
    } else {
      console.warn('Failed to fetch attendance records:', result?.error);
      calendarManager.showError(result?.error || '未知错误');
    }
  } catch (error) {
    console.error('Error fetching attendance records:', error);
    calendarManager.showError('获取考勤记录时出错');
  }
}

/**
 * Load current month's attendance records
 */
async function loadCurrentMonthAttendance(): Promise<void> {
  const csrf = authManager.getCsrf();

  if (!csrf) {
    console.error('No CSRF token available');
    return;
  }

  calendarManager.showLoading();

  try {
    const result = await window.electronAPI?.getAttendanceRecords?.(csrf);

    if (result?.success && result.data) {
      console.log('Attendance records fetched successfully');
      authManager.setYearmo(result.data.attendanceArchive.yearmo);
      calendarManager.render(result.data, loadAttendanceForMonth);
    } else {
      console.warn('Failed to fetch attendance records:', result?.error);
      calendarManager.showError(result?.error || '未知错误');
    }
  } catch (error) {
    console.error('Error fetching attendance records:', error);
    calendarManager.showError('获取考勤记录时出错');
  }
}

function toMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function showCheckinSettingsMessage(message: string, type: 'success' | 'error' | 'neutral' = 'neutral'): void {
  if (!checkinSettingsMessage) return;

  checkinSettingsMessage.textContent = message;
  checkinSettingsMessage.classList.remove('success', 'error');
  if (type !== 'neutral') {
    checkinSettingsMessage.classList.add(type);
  }
}

function populateCheckinSettingsForm(): void {
  const settings = settingsManager.loadCheckinTimeSettings();
  if (checkinStartTimeInput) checkinStartTimeInput.value = settings.startTime;
  if (checkinEndTimeInput) checkinEndTimeInput.value = settings.endTime;
  showCheckinSettingsMessage('当前设置会用于下一次一键打卡分析。');
}

function openCheckinSettingsDialog(): void {
  populateCheckinSettingsForm();
  checkinSettingsDialog?.classList.remove('hidden');
  checkinStartTimeInput?.focus();
}

function closeCheckinSettingsDialog(): void {
  checkinSettingsDialog?.classList.add('hidden');
}

function saveCheckinSettings(): void {
  const startTime = checkinStartTimeInput?.value || '';
  const endTime = checkinEndTimeInput?.value || '';

  if (!startTime || !endTime) {
    showCheckinSettingsMessage('请填写上班和下班补签时间。', 'error');
    return;
  }

  if (toMinutes(startTime) >= toMinutes(endTime)) {
    showCheckinSettingsMessage('上班补签时间必须早于下班补签时间。', 'error');
    return;
  }

  const savedSettings = settingsManager.saveCheckinTimeSettings({ startTime, endTime });
  if (checkinStartTimeInput) checkinStartTimeInput.value = savedSettings.startTime;
  if (checkinEndTimeInput) checkinEndTimeInput.value = savedSettings.endTime;
  showCheckinSettingsMessage('补签时间设置已保存。', 'success');
}

/**
 * Verify cookies and display user info
 * @param clearOnFailure Whether to clear cookies if verification fails (true for startup, false for cookie updates)
 */
async function verifyCookiesAndShowInfo(clearOnFailure = false): Promise<void> {
  authManager.updateTopBarDisplay(userDisplayName, 'loading');

  try {
    const result = await authManager.verifyCookies(clearOnFailure);

    if (result?.success && result.data) {
      hasLoginPromptShown = false; // 登录成功后允许下次再次提示
      // Update top bar display
      authManager.updateTopBarDisplay(userDisplayName, 'loggedIn');

      console.log('Cookie verification successful:', result.data);

      // Destroy WebView when login is successful
      webviewManager.destroy();

      // Fetch attendance records
      await loadCurrentMonthAttendance();
    } else {
      // Update top bar to show not logged in
      authManager.updateTopBarDisplay(userDisplayName, 'loggedOut');

      console.log('Cookie verification failed:', result?.error);

      // Create WebView when login fails
      webviewManager.create();

      // 提示用户跳转登录（只提示一次，避免反复打扰）
      if (!hasLoginPromptShown) {
        hasLoginPromptShown = true;
        const confirmLogin = window.confirm('登录状态已失效，需要重新登录。\n是否前往登录页？');
        if (confirmLogin) {
          // 重新创建 WebView，保证容器有内容且可见
          webviewManager.destroy();
          webviewManager.showLoginPage();
        }
      }
    }
  } catch (error) {
    // Update top bar to show error
    authManager.updateTopBarDisplay(userDisplayName, 'error');

    console.error('Failed to verify cookies:', error);

    // Create WebView on verification error
    webviewManager.create();

    // 出错时也提示一次跳转
    if (!hasLoginPromptShown) {
      hasLoginPromptShown = true;
      const confirmLogin = window.confirm('验证出错，需要重新登录。\n是否前往登录页？');
      if (confirmLogin) {
        webviewManager.destroy();
        webviewManager.showLoginPage();
      }
    }
  }
}

// ==================== Event Listeners ====================

// Settings menu toggle
if (settingsMenuBtn && settingsDropdown) {
  settingsMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown(settingsDropdown, [userDropdown]);
  });

  settingsDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

// Check-in time settings menu item
if (checkinSettingsMenuItem) {
  checkinSettingsMenuItem.addEventListener('click', () => {
    settingsDropdown?.classList.add('hidden');
    openCheckinSettingsDialog();
  });
}

if (checkinSettingsCloseBtn) {
  checkinSettingsCloseBtn.addEventListener('click', closeCheckinSettingsDialog);
}

if (checkinSettingsDialog) {
  checkinSettingsDialog.addEventListener('click', (e) => {
    if (e.target === checkinSettingsDialog) {
      closeCheckinSettingsDialog();
    }
  });
}

if (checkinSettingsSaveBtn) {
  checkinSettingsSaveBtn.addEventListener('click', saveCheckinSettings);
}

if (checkinSettingsResetBtn) {
  checkinSettingsResetBtn.addEventListener('click', () => {
    const defaultSettings = settingsManager.resetCheckinTimeSettings();
    if (checkinStartTimeInput) checkinStartTimeInput.value = defaultSettings.startTime;
    if (checkinEndTimeInput) checkinEndTimeInput.value = defaultSettings.endTime;
    showCheckinSettingsMessage('已恢复默认补签时间。', 'success');
  });
}

// Open login page menu item
if (openLoginMenuItem) {
  openLoginMenuItem.addEventListener('click', () => {
    settingsDropdown?.classList.add('hidden');
    // 强制重建 WebView 并加载登录页
    webviewManager.destroy();
    webviewManager.showLoginPage();
  });
}

// User menu toggle
if (userMenuBtn && userDropdown) {
  userMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();

    const userInfo = authManager.getUserInfo();
    if (!userInfo) {
      alert('未登录或登录信息不可用');
      return;
    }

    // Update dropdown content
    authManager.updateDropdownDisplay(dropdownCompany, dropdownEmployee, dropdownCsrf);

    // Toggle dropdown visibility
    toggleDropdown(userDropdown, [settingsDropdown]);
  });

  userDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

// Close all dropdowns when clicking outside
document.addEventListener('click', () => {
  closeAllDropdowns([userDropdown, settingsDropdown]);
});

// View cookies menu item
if (viewCookiesMenuItem) {
  viewCookiesMenuItem.addEventListener('click', async () => {
    // Close settings dropdown
    settingsDropdown?.classList.add('hidden');

    // Load cookies from file
    const cookies = await cookieManager.loadAll();

    // Show cookie dialog
    if (cookieDialog && cookieDialogDisplay) {
      cookieManager.renderCookieTree(cookies, cookieDialogDisplay);
      cookieDialog.classList.remove('hidden');
      console.log('Displayed', cookies?.length || 0, 'cookies from file in dialog');
    }
  });
}

// Clear cookies menu item
if (clearCookiesMenuItem) {
  clearCookiesMenuItem.addEventListener('click', async () => {
    // Close settings dropdown
    settingsDropdown?.classList.add('hidden');

    const result = await cookieManager.clearAll();

    if (result.success) {
      alert('Cookie 已清空');

      // Reset auth state
      authManager.clear();

      // Update UI
      authManager.updateTopBarDisplay(userDisplayName, 'loggedOut');

      // Clear calendar
      calendarManager.clear();

      // Show WebView for re-login
      webviewManager.create();
    } else if (result.error !== 'User cancelled') {
      alert('清空失败: ' + result.error);
    }
  });
}

// Close cookie dialog button
if (closeDialogBtn && cookieDialog) {
  closeDialogBtn.addEventListener('click', () => {
    cookieDialog.classList.add('hidden');
  });
}

// Close cookie dialog when clicking overlay
if (cookieDialog) {
  cookieDialog.addEventListener('click', (e) => {
    if (e.target === cookieDialog) {
      cookieDialog.classList.add('hidden');
    }
  });
}

// Quick check-in FAB button
if (quickCheckinFab) {
  quickCheckinFab.addEventListener('click', async () => {
    console.log('Quick check-in button clicked');

    const csrf = authManager.getCsrf();
    const yearmo = authManager.getYearmo();
    const userInfo = authManager.getUserInfo();

    // Check if logged in
    if (!csrf || !userInfo || !yearmo) {
      alert('请先登录');
      return;
    }

    // Create checkin manager and start
    const checkinManager = new CheckinManager(
      checkinDialog,
      checkinDialogTitle,
      checkinDialogContent,
      csrf,
      yearmo,
      settingsManager.loadCheckinTimeSettings(),
      async () => {
        // Refresh calendar callback
        await loadCurrentMonthAttendance();
      }
    );

    await checkinManager.start();
  });
}

// Close check-in dialog button
if (checkinDialogCloseBtn) {
  checkinDialogCloseBtn.addEventListener('click', () => {
    // Only allow closing if not processing
    // The CheckinManager doesn't expose isRunning publicly, so we rely on UI state
    checkinDialog?.classList.add('hidden');
  });
}

// Close check-in dialog when clicking overlay
if (checkinDialog) {
  checkinDialog.addEventListener('click', (e) => {
    if (e.target === checkinDialog) {
      // Only allow closing if not processing
      checkinDialog.classList.add('hidden');
    }
  });
}

// ==================== Initialize App ====================

// Call verification on startup (with cookie clearing enabled)
verifyCookiesAndShowInfo(true);

// Listen for cookie updates and re-verify (without cookie clearing)
window.electronAPI?.onCookiesUpdated?.(() => {
  console.log('Cookies updated, re-verifying...');
  verifyCookiesAndShowInfo(false);
});
