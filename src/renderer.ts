/**
 * Main renderer process entry point
 */

import './index.css';
import { AuthManager } from './modules/auth';
import { CalendarManager } from './modules/calendar';
import { WebViewManager } from './modules/webview';
import { CookieManager } from './modules/cookies';
import { CheckinManager } from './modules/checkin';
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
const viewCookiesMenuItem = document.getElementById('view-cookies-menu-item') as HTMLButtonElement;
const clearCookiesMenuItem = document.getElementById('clear-cookies-menu-item') as HTMLButtonElement;

// Cookie dialog elements
const cookieDialog = document.getElementById('cookie-dialog') as HTMLDivElement;
const cookieDialogDisplay = document.getElementById('cookie-dialog-display') as HTMLDivElement;
const closeDialogBtn = document.getElementById('close-dialog-btn') as HTMLButtonElement;

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
    const result = await (window as any).electronAPI?.getAttendanceRecords?.(csrf, targetYearmo);

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
    const result = await (window as any).electronAPI?.getAttendanceRecords?.(csrf);

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
 * Verify cookies and display user info
 * @param clearOnFailure Whether to clear cookies if verification fails (true for startup, false for cookie updates)
 */
async function verifyCookiesAndShowInfo(clearOnFailure: boolean = false): Promise<void> {
  authManager.updateTopBarDisplay(userDisplayName, 'loading');

  try {
    const result = await authManager.verifyCookies(clearOnFailure);

    if (result?.success && result.data) {
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
    }
  } catch (error) {
    // Update top bar to show error
    authManager.updateTopBarDisplay(userDisplayName, 'error');

    console.error('Failed to verify cookies:', error);

    // Create WebView on verification error
    webviewManager.create();
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
(window as any).electronAPI?.onCookiesUpdated?.(() => {
  console.log('Cookies updated, re-verifying...');
  verifyCookiesAndShowInfo(false);
});
