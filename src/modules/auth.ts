import type { UserInfo } from '../types';

/**
 * 认证管理器
 * 负责用户认证、Cookie 验证和用户信息管理
 */
export class AuthManager {
  private currentUserInfo: UserInfo | null = null;
  private currentCsrf: string | null = null;
  private currentYearmo: string | null = null;

  /**
   * 验证 Cookies 并获取用户信息
   * @param clearOnFailure 是否在验证失败时清除 Cookie（仅用于启动时）
   */
  async verifyCookies(clearOnFailure: boolean = false): Promise<{
    success: boolean;
    data?: UserInfo;
    error?: string;
  }> {
    try {
      const result = await (window as any).electronAPI?.verifyCookies?.(clearOnFailure);

      if (result?.success && result.data) {
        this.currentUserInfo = result.data;
        this.currentCsrf = result.data.csrf;
      }

      return result;
    } catch (error) {
      console.error('Failed to verify cookies:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 获取当前用户信息
   */
  getUserInfo(): UserInfo | null {
    return this.currentUserInfo;
  }

  /**
   * 获取 CSRF Token
   */
  getCsrf(): string | null {
    return this.currentCsrf;
  }

  /**
   * 获取当前年月
   */
  getYearmo(): string | null {
    return this.currentYearmo;
  }

  /**
   * 设置当前年月
   */
  setYearmo(yearmo: string): void {
    this.currentYearmo = yearmo;
  }

  /**
   * 清空认证信息
   */
  clear(): void {
    this.currentUserInfo = null;
    this.currentCsrf = null;
    this.currentYearmo = null;
  }

  /**
   * 更新下拉菜单中的用户信息显示
   */
  updateDropdownDisplay(
    companyEl: HTMLElement,
    employeeEl: HTMLElement,
    csrfEl: HTMLElement
  ): void {
    if (!this.currentUserInfo) return;

    const { companyName, employeeName, csrf } = this.currentUserInfo;

    if (companyEl) companyEl.textContent = companyName;
    if (employeeEl) employeeEl.textContent = employeeName;
    if (csrfEl) csrfEl.textContent = csrf;
  }

  /**
   * 更新顶部栏显示名称
   */
  updateTopBarDisplay(displayEl: HTMLElement, status: 'loading' | 'loggedIn' | 'loggedOut' | 'error'): void {
    const texts = {
      loading: '验证中...',
      loggedIn: this.currentUserInfo?.employeeName || '已登录',
      loggedOut: '未登录',
      error: '验证失败',
    };

    if (displayEl) {
      displayEl.textContent = texts[status];
    }
  }
}
