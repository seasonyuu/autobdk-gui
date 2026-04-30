import { app, session } from 'electron';
import type { CookiesSetDetails } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import type { ICredential } from '../api';

export class CookieStore {
  private readonly cookiesFile: string;
  private lastCookiesHash = '';

  constructor() {
    this.cookiesFile = path.join(app.getPath('userData'), 'webview-cookies.json');
  }

  /**
   * Save cookies to file
   */
  save(cookies: Electron.Cookie[]): void {
    try {
      fs.writeFileSync(this.cookiesFile, JSON.stringify(cookies, null, 2), 'utf-8');
      console.log('Cookies saved to:', this.cookiesFile);
    } catch (error) {
      console.error('Failed to save cookies:', error);
    }
  }

  /**
   * Load cookies from file
   */
  load(): Electron.Cookie[] {
    try {
      if (fs.existsSync(this.cookiesFile)) {
        const data = fs.readFileSync(this.cookiesFile, 'utf-8');
        const cookies = JSON.parse(data);
        return cookies;
      }
    } catch (error) {
      console.error('Failed to load cookies:', error);
    }
    return [];
  }

  /**
   * Check if cookies changed and save if needed
   */
  handleCookiesChanged(cookies: Electron.Cookie[]): boolean {
    const currentHash = this.getCookiesHash(cookies);
    
    if (currentHash !== this.lastCookiesHash) {
      this.save(cookies);
      this.lastCookiesHash = currentHash;
      return true;
    }
    
    return false;
  }

  /**
   * Delete cookie file
   */
  clearFile(): void {
    if (fs.existsSync(this.cookiesFile)) {
      fs.unlinkSync(this.cookiesFile);
      console.log('Cookie file deleted');
    }
  }

  /**
   * Delete specific cookie from file
   */
  deleteFromFile(name: string, domain: string, pathStr: string): Electron.Cookie[] {
    const cookies = this.load();
    const updatedCookies = cookies.filter((cookie) => 
      !(cookie.name === name && cookie.domain === domain && cookie.path === pathStr)
    );
    
    if (cookies.length !== updatedCookies.length) {
      this.save(updatedCookies);
    }
    
    return updatedCookies;
  }

  /**
   * Restore cookies to session
   */
  async restoreToSession(partition = 'persist:mobile'): Promise<void> {
    const cookies = this.load();
    if (cookies.length === 0) return;

    console.log('Restoring cookies from file...');
    const webviewSession = session.fromPartition(partition);

    for (const cookie of cookies) {
      const cookieDetails = this.toCookiesSetDetails(cookie);
      if (!cookieDetails) continue;
      
      try {
        await webviewSession.cookies.set(cookieDetails);
      } catch (err) {
        console.warn('Failed to restore cookie:', cookie.name, err);
      }
    }
    console.log('Restored', cookies.length, 'cookies');
  }

  /**
   * Get credentials for API calls
   */
  getCredentials(csrf: string): ICredential | null {
    const cookies = this.load();
    if (cookies.length === 0) {
      console.log('No saved cookies found');
      return null;
    }

    const cookieString = cookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join('; ');

    return {
      'Cookie': cookieString,
      'X-CSRF-TOKEN': csrf,
    };
  }

  /**
   * Convert stored cookies into Electron's accepted set details.
   */
  private toCookiesSetDetails(cookie: Electron.Cookie): CookiesSetDetails | null {
    const domain = cookie.domain?.startsWith('.')
      ? cookie.domain.substring(1)
      : cookie.domain;
    const cookiePath = cookie.path || '/';

    if (!domain) {
      console.warn('Failed to restore cookie: missing domain for', cookie.name);
      return null;
    }

    return {
      url: `https://${domain}${cookiePath}`,
      name: cookie.name,
      value: cookie.value,
      domain,
      path: cookiePath,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      expirationDate: cookie.expirationDate,
      sameSite: cookie.sameSite,
    };
  }

  /**
   * Helper to hash cookies
   */
  private getCookiesHash(cookies: Electron.Cookie[]): string {
    return cookies
      .map(c => `${c.name}=${c.value}`)
      .sort()
      .join('|');
  }
}

export const cookieStore = new CookieStore();
