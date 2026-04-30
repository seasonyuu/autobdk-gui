import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const allowedFiles = new Set([
  'package.json',
  'src/electron-env.d.ts',
  'src/main.ts',
  'src/main-lib/ipc-handlers.ts',
  'src/modules/webview.ts',
  'src/preload.ts',
]);

function readTrackedSource(relativePath) {
  assert.equal(
    allowedFiles.has(relativePath),
    true,
    `S03 contract tests may only read tracked source/package files, got ${relativePath}`
  );

  const absolutePath = path.resolve(projectRoot, relativePath);
  assert.equal(
    absolutePath.startsWith(projectRoot + path.sep),
    true,
    `S03 contract path must stay inside project root: ${relativePath}`
  );
  assert.equal(existsSync(absolutePath), true, `Expected source file is missing: ${relativePath}`);

  return readFileSync(absolutePath, 'utf8');
}

function assertSourceContains(relativePath, pattern, message) {
  const source = readTrackedSource(relativePath);
  assert.match(source, pattern, message);
}

test('package.json exposes the S03 static security contract script', () => {
  const packageJson = JSON.parse(readTrackedSource('package.json'));

  assert.equal(
    packageJson.scripts?.['test:s03'],
    'node --test tests/s03-electron-security-contract.test.mjs',
    'package.json must expose npm run test:s03 without external dependencies'
  );
});

test('S03 source reader rejects ignored and runtime-only paths', () => {
  for (const deniedPath of ['.gsd/state.json', '.env', 'dist/main/index.js', 'webview-cookies.json']) {
    assert.throws(
      () => readTrackedSource(deniedPath),
      /may only read tracked source\/package files/,
      `S03 contract test reader must reject ${deniedPath}`
    );
  }
});

test('src/main-lib/ipc-handlers.ts declares trusted sender validation helpers', () => {
  assertSourceContains(
    'src/main-lib/ipc-handlers.ts',
    /isTrustedIpcSender/,
    'IPC handlers must define an isTrustedIpcSender helper for sender/origin checks'
  );
  assertSourceContains(
    'src/main-lib/ipc-handlers.ts',
    /Unauthorized IPC sender/,
    'IPC handlers must reject invalid callers with a consistent non-secret error'
  );
});

test('src/main-lib/ipc-handlers.ts wraps privileged IPC registrations with sender guards', () => {
  assertSourceContains(
    'src/main-lib/ipc-handlers.ts',
    /registerTrustedIpcHandle/,
    'privileged invoke handlers must be registered through a trusted IPC handle wrapper'
  );
  assertSourceContains(
    'src/main-lib/ipc-handlers.ts',
    /registerTrustedIpcOn/,
    'privileged send handlers must be registered through a trusted IPC on wrapper'
  );
});

test('src/modules/webview.ts declares login origin allowlist and navigation guards', () => {
  assertSourceContains(
    'src/modules/webview.ts',
    /XINRENXINSHI_LOGIN_ORIGIN/,
    'WebView must declare the Xinrenxinshi login origin boundary'
  );
  assertSourceContains(
    'src/modules/webview.ts',
    /isAllowedWebViewUrl/,
    'WebView must guard navigation through an allowlist helper'
  );
  assertSourceContains(
    'src/modules/webview.ts',
    /will-navigate/,
    'WebView must observe and constrain navigation attempts'
  );
  assertSourceContains(
    'src/modules/webview.ts',
    /new-window|window-open/,
    'WebView must observe and constrain popup/window-open attempts'
  );
});

test('src/modules/webview.ts keeps remote WebView Node and preload integration disabled', () => {
  const source = readTrackedSource('src/modules/webview.ts');

  assert.match(source, /setAttribute\('nodeintegration',\s*'false'\)/, 'WebView must explicitly disable nodeintegration');
  assert.match(source, /setAttribute\('disablewebsecurity',\s*'false'\)/, 'WebView must not disable web security');
  assert.doesNotMatch(source, /setAttribute\('preload'/, 'remote login WebView must not receive a preload script');
});

test('preload exposed methods remain aligned with IElectronAPI names', () => {
  const preloadSource = readTrackedSource('src/preload.ts');
  const envSource = readTrackedSource('src/electron-env.d.ts');
  const exposedMethods = [...preloadSource.matchAll(/^  (\w+):/gm)].map((match) => match[1]).sort();
  const declaredMethods = [...envSource.matchAll(/^  (\w+):/gm)].map((match) => match[1]).sort();

  assert.deepEqual(
    exposedMethods,
    declaredMethods,
    'preload must not expose methods outside the typed IElectronAPI contract'
  );
});

test('S03 contract tests remain non-destructive for attendance approval', () => {
  const preloadSource = readTrackedSource('src/preload.ts');
  const testSource = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  const prohibitedLiveCall = 'window.electronAPI?.' + 'startAttendanceApproval';

  assert.equal(
    testSource.includes(prohibitedLiveCall),
    false,
    'S03 contract tests must not call the live attendance approval IPC path'
  );
  assert.match(
    preloadSource,
    /startAttendanceApproval/,
    'static inspection may mention the approval IPC method without invoking it'
  );
});
