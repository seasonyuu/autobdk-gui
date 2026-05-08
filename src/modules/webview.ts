const XINRENXINSHI_LOGIN_ORIGIN = 'https://e.xinrenxinshi.com';
const XINRENXINSHI_LOGIN_URL = `${XINRENXINSHI_LOGIN_ORIGIN}/`;

type WebViewUrlEvent = Event & {
  url?: string;
  preventDefault: () => void;
};

const isAllowedWebViewUrl = (targetUrl: string): boolean => {
  try {
    return new URL(targetUrl).origin === XINRENXINSHI_LOGIN_ORIGIN;
  } catch {
    return false;
  }
};

const toSafeUrlForLog = (targetUrl: string): string => {
  try {
    return new URL(targetUrl).origin;
  } catch {
    return 'invalid-url';
  }
};

/**
 * WebView 管理器
 * 负责创建、配置和销毁 WebView
 */
export class WebViewManager {
  private webview: Electron.WebviewTag | null = null;
  private isEnvReady = false;
  private resizeObserver: ResizeObserver | null = null;
  private resizeTimeout: number | null = null;
  private readonly mobileUserAgent =
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';

  constructor(
    private container: HTMLDivElement,
    private leftContent?: HTMLElement,
    private fab?: HTMLElement
  ) {}

  /**
   * 更新设备尺寸
   */
  private updateDeviceMetrics(): void {
    if (!this.webview || !this.isEnvReady) return;

    const webviewRect = this.webview.getBoundingClientRect();
    const viewportWidth = Math.max(320, Math.round(webviewRect.width));
    const viewportHeight = Math.max(480, Math.round(webviewRect.height));

    const webContentsId = this.webview.getWebContentsId();
    window.electronAPI?.enableDeviceEmulation?.(
      webContentsId,
      viewportWidth,
      viewportHeight
    );

    console.log(`Device metrics updated: ${viewportWidth}x${viewportHeight}`);
  }

  private loadLoginPageIfNeeded(): void {
    if (!this.webview) return;

    const currentUrl =
      typeof this.webview.getURL === 'function'
        ? this.webview.getURL()
        : this.webview.getAttribute('src');

    if (currentUrl === XINRENXINSHI_LOGIN_URL) return;

    if (typeof this.webview.loadURL === 'function') {
      this.webview.loadURL(XINRENXINSHI_LOGIN_URL);
    } else {
      this.webview.setAttribute('src', XINRENXINSHI_LOGIN_URL);
    }
  }

  /**
   * 创建并初始化 WebView
   */
  create(): void {
    if (this.webview) return; // Already created

    try {
      console.log('Creating WebView...');

      // Hide left content and FAB when showing WebView
      if (this.leftContent) {
        this.leftContent.classList.add('hidden');
      }
      if (this.fab) {
        this.fab.classList.add('hidden');
      }

      // 确保容器可见
      this.container.style.display = 'flex';

      this.webview = document.createElement('webview');
      this.webview.id = 'mobile-webview';
      this.webview.className = 'mobile-webview';
      this.webview.setAttribute('partition', 'persist:mobile');
      // Remote login content is intentionally isolated: no Node, no preload, no disabled web security.
      this.webview.setAttribute('nodeintegration', 'false');
      this.webview.setAttribute('disablewebsecurity', 'false');
      this.webview.setAttribute('allowpopups', 'false');
      // 通过属性提前设置 UA，避免提前调用 getWebContentsId 触发错误
      this.webview.setAttribute('useragent', this.mobileUserAgent);
      this.webview.src = XINRENXINSHI_LOGIN_URL;

      this.container.appendChild(this.webview);
      console.log('WebView appended, container children:', this.container.childElementCount);
    } catch (err) {
      console.error('Failed to create WebView:', err);
      this.webview = null;
      return;
    }

    // Setup webview event listeners
    this.webview.addEventListener('dom-ready', () => {
      console.log('WebView loaded successfully');

      if (!this.isEnvReady && this.webview) {
        this.webview.setUserAgent(this.mobileUserAgent);
        console.log('UserAgent set to:', this.mobileUserAgent);

        // Mark as ready before updating metrics
        this.isEnvReady = true;

        // Get actual container dimensions and enable device emulation
        this.updateDeviceMetrics();

        // Start monitoring cookies
        const webContentsId = this.webview.getWebContentsId();
        window.electronAPI?.startCookieMonitoring?.(webContentsId);
        console.log('Cookie monitoring started');
      }
    });

    this.webview.addEventListener('will-navigate', (event) => {
      this.guardWebViewUrl(event as WebViewUrlEvent, 'navigation');
    });

    this.webview.addEventListener('new-window', (event) => {
      this.guardWebViewUrl(event as WebViewUrlEvent, 'new-window');
    });

    // Disable right-click context menu
    this.webview.addEventListener('context-menu', (e) => {
      e.preventDefault();
    });

    // Setup ResizeObserver to monitor the rendered WebView size used by device emulation.
    this.resizeObserver = new ResizeObserver(() => {
      // Debounce resize updates
      if (this.resizeTimeout !== null) {
        clearTimeout(this.resizeTimeout);
      }

      this.resizeTimeout = window.setTimeout(() => {
        this.updateDeviceMetrics();
      }, 300); // Wait 300ms after resize stops
    });

    this.resizeObserver.observe(this.webview);

    console.log('WebView created and initialized');
  }

  /**
   * 销毁 WebView
   */
  destroy(): void {
    if (!this.webview) return;

    console.log('Destroying WebView...');

    // Clean up ResizeObserver
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Clear resize timeout
    if (this.resizeTimeout !== null) {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = null;
    }

    this.webview.remove();
    this.webview = null;
    this.isEnvReady = false;

    // Show left content and FAB when hiding WebView
    if (this.leftContent) {
      this.leftContent.classList.remove('hidden');
    }
    if (this.fab) {
      this.fab.classList.remove('hidden');
    }
  }

  /**
   * 获取 WebView 实例
   */
  getWebView(): Electron.WebviewTag | null {
    return this.webview;
  }

  /**
   * 强制显示登录页（若未创建则创建）
   */
  showLoginPage(): void {
    if (!this.webview) {
      this.create();
    }
    if (!this.webview) return;

    // 确保容器显示
    this.container.style.display = 'flex';

    this.loadLoginPageIfNeeded();
  }

  /**
   * 检查 WebView 是否已创建
   */
  isCreated(): boolean {
    return this.webview !== null;
  }

  private guardWebViewUrl(event: WebViewUrlEvent, kind: 'navigation' | 'new-window'): void {
    const targetUrl = event.url || '';
    if (isAllowedWebViewUrl(targetUrl)) return;

    event.preventDefault();
    console.warn(`Blocked WebView ${kind}:`, toSafeUrlForLog(targetUrl));
  }
}
