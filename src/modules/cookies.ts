import { escapeHtml } from '../utils/dom';

/**
 * Cookie 管理器
 * 负责 Cookie 的查看、删除和管理
 */
export class CookieManager {
  /**
   * 渲染 Cookie 树形结构
   */
  renderCookieTree(cookies: any[], container: HTMLElement): void {
    if (!cookies || cookies.length === 0) {
      container.innerHTML = '<div class="cookie-display-empty">暂无 Cookie</div>';
      return;
    }

    // Group cookies by domain
    const domainMap = new Map<string, any[]>();
    cookies.forEach((cookie) => {
      const domain = cookie.domain;
      if (!domainMap.has(domain)) {
        domainMap.set(domain, []);
      }
      domainMap.get(domain)!.push(cookie);
    });

    // Build tree HTML
    const treeHTML = Array.from(domainMap.entries())
      .map(([domain, domainCookies]) => {
        const cookieItems = domainCookies
          .map((cookie) => {
            const expiresText = cookie.expirationDate
              ? new Date(cookie.expirationDate * 1000).toLocaleString()
              : 'Session';

            return `
            <li class="cookie-item" data-cookie-name="${cookie.name}" data-cookie-domain="${cookie.domain}" data-cookie-path="${cookie.path}">
              <div class="cookie-item-content">
                <div class="cookie-item-name">${escapeHtml(cookie.name)}</div>
                <div class="cookie-item-value">${escapeHtml(cookie.value)}</div>
                <div class="cookie-item-meta">
                  Path: ${escapeHtml(cookie.path)} |
                  Expires: ${expiresText} |
                  ${cookie.secure ? '🔒 Secure' : ''}
                  ${cookie.httpOnly ? '🛡️ HttpOnly' : ''}
                  ${cookie.sameSite ? `SameSite: ${cookie.sameSite}` : ''}
                </div>
              </div>
              <button class="cookie-item-delete" data-cookie-name="${cookie.name}" data-cookie-domain="${cookie.domain}" data-cookie-path="${cookie.path}">删除</button>
            </li>
          `;
          })
          .join('');

        return `
        <li>
          <div class="cookie-domain" data-domain="${domain}">
            <span class="cookie-domain-toggle">▼</span>
            <span class="cookie-domain-name">${escapeHtml(domain)}</span>
            <span class="cookie-domain-count">(${domainCookies.length})</span>
          </div>
          <ul class="cookie-items">
            ${cookieItems}
          </ul>
        </li>
      `;
      })
      .join('');

    container.innerHTML = `<ul class="cookie-tree">${treeHTML}</ul>`;

    // Add toggle handlers for domains
    container.querySelectorAll('.cookie-domain').forEach((domainEl) => {
      domainEl.addEventListener('click', () => {
        const toggle = domainEl.querySelector('.cookie-domain-toggle');
        const items = domainEl.nextElementSibling as HTMLElement;

        if (items.classList.contains('collapsed')) {
          items.classList.remove('collapsed');
          if (toggle) toggle.textContent = '▼';
        } else {
          items.classList.add('collapsed');
          if (toggle) toggle.textContent = '▶';
        }
      });
    });

    // Add delete handlers for individual cookies
    container.querySelectorAll('.cookie-item-delete').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const name = btn.getAttribute('data-cookie-name')!;
        const domain = btn.getAttribute('data-cookie-domain')!;
        const path = btn.getAttribute('data-cookie-path')!;

        if (!confirm(`确定要删除 Cookie "${name}" 吗？`)) return;

        const result = await (window as any).electronAPI?.deleteCookieFromFile?.(
          name,
          domain,
          path
        );

        if (result?.success) {
          console.log('Cookie deleted from file:', name);
          // Refresh the display
          const cookies = await (window as any).electronAPI?.loadCookies?.();
          this.renderCookieTree(cookies, container);
        } else {
          alert('删除失败: ' + (result?.error || 'Unknown error'));
        }
      });
    });
  }

  /**
   * 清空所有 Cookies
   */
  async clearAll(): Promise<{ success: boolean; error?: string }> {
    const confirmed = confirm('确定要清空所有 Cookie 吗？这将退出登录状态。');
    if (!confirmed) {
      return { success: false, error: 'User cancelled' };
    }

    const result = await (window as any).electronAPI?.clearCookiesFile?.();

    if (result?.success) {
      console.log('Cookie file cleared successfully');
      return { success: true };
    } else {
      console.error('Failed to clear cookie file:', result?.error);
      return { success: false, error: result?.error };
    }
  }

  /**
   * 加载所有 Cookies
   */
  async loadAll(): Promise<any[]> {
    const cookies = await (window as any).electronAPI?.loadCookies?.();
    return cookies || [];
  }
}
