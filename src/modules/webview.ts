/**
 * WebView 管理器
 * 负责创建、配置和销毁 WebView
 */
export class WebViewManager {
  private webview: Electron.WebviewTag | null = null;
  private isEnvReady = false;
  private resizeObserver: ResizeObserver | null = null;
  private resizeTimeout: number | null = null;

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

    const containerWidth = this.container.clientWidth;
    const containerHeight = this.container.clientHeight;

    const webContentsId = this.webview.getWebContentsId();
    (window as any).electronAPI?.enableDeviceEmulation?.(
      webContentsId,
      containerWidth,
      containerHeight
    );

    console.log(`Device metrics updated: ${containerWidth}x${containerHeight}`);
  }

  /**
   * 创建并初始化 WebView
   */
  create(): void {
    if (this.webview) return; // Already created

    console.log('Creating WebView...');

    // Hide left content and FAB when showing WebView
    if (this.leftContent) {
      this.leftContent.classList.add('hidden');
    }
    if (this.fab) {
      this.fab.classList.add('hidden');
    }

    this.webview = document.createElement('webview');
    this.webview.id = 'mobile-webview';
    this.webview.className = 'mobile-webview';
    this.webview.src = 'https://e.xinrenxinshi.com';
    this.webview.setAttribute('partition', 'persist:mobile');

    this.container.appendChild(this.webview);

    // Setup webview event listeners
    this.webview.addEventListener('dom-ready', () => {
      console.log('WebView loaded successfully');

      if (!this.isEnvReady && this.webview) {
        const userAgent =
          'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
        this.webview.setUserAgent(userAgent);
        console.log('UserAgent set to:', userAgent);

        // Mark as ready before updating metrics
        this.isEnvReady = true;

        // Get actual container dimensions and enable device emulation
        this.updateDeviceMetrics();

        // Start monitoring cookies
        const webContentsId = this.webview.getWebContentsId();
        (window as any).electronAPI?.startCookieMonitoring?.(webContentsId);
        console.log('Cookie monitoring started');
      }
    });

    // Disable right-click context menu
    this.webview.addEventListener('context-menu', (e) => {
      e.preventDefault();
    });

    // Setup ResizeObserver to monitor container size changes
    this.resizeObserver = new ResizeObserver(() => {
      // Debounce resize updates
      if (this.resizeTimeout !== null) {
        clearTimeout(this.resizeTimeout);
      }

      this.resizeTimeout = window.setTimeout(() => {
        this.updateDeviceMetrics();
      }, 300); // Wait 300ms after resize stops
    });

    this.resizeObserver.observe(this.container);

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
   * 检查 WebView 是否已创建
   */
  isCreated(): boolean {
    return this.webview !== null;
  }
}
