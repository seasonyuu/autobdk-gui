import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const allowedFiles = new Set([
  'package.json',
  'src/api.ts',
  'src/electron-env.d.ts',
  'src/main-lib/cookie-store.ts',
  'src/main-lib/ipc-handlers.ts',
  'src/modules/auth.ts',
  'src/preload.ts',
  'src/renderer.ts',
  'src/types.ts',
]);

function readTrackedSource(relativePath) {
  assert.equal(
    allowedFiles.has(relativePath),
    true,
    `S02 contract tests may only read tracked source/package files, got ${relativePath}`
  );

  const absolutePath = path.resolve(projectRoot, relativePath);
  assert.equal(
    absolutePath.startsWith(projectRoot + path.sep),
    true,
    `S02 contract path must stay inside project root: ${relativePath}`
  );
  assert.equal(existsSync(absolutePath), true, `Expected source file is missing: ${relativePath}`);

  return readFileSync(absolutePath, 'utf8');
}

function assertNoPattern(relativePath, pattern, message) {
  const source = readTrackedSource(relativePath);
  assert.equal(pattern.test(source), false, message);
}

test('package.json exposes the S02 static contract script', () => {
  const packageJson = JSON.parse(readTrackedSource('package.json'));

  assert.equal(
    packageJson.scripts?.['test:s02'],
    'node --test tests/s02-boundary-contract.test.mjs',
    'package.json must expose npm run test:s02 without external dependencies'
  );
});

test('src/api.ts avoids boxed String and empty-object envelope boundaries', () => {
  assertNoPattern(
    'src/api.ts',
    /redirect\?:\s*String\b/,
    'src/api.ts must use primitive string for redirect'
  );
  assertNoPattern(
    'src/api.ts',
    /IEnvelope<\{\}>/,
    'src/api.ts must not use {} for the approval IPC/API envelope'
  );
});

test('src/types.ts defines reusable IPC and renderer-safe API boundary types', () => {
  const source = readTrackedSource('src/types.ts');

  assert.match(
    source,
    /export type IpcResult<T = void>/,
    'src/types.ts must define the reusable IpcResult envelope'
  );
  assert.match(
    source,
    /success:\s*true;\s*data\?:\s*T/s,
    'IpcResult must allow success results with optional data'
  );
  assert.match(
    source,
    /success:\s*false;\s*error:\s*string/s,
    'IpcResult must allow error-only failures without data'
  );
  assert.match(
    source,
    /export type ElectronCookie = Cookie/,
    'src/types.ts must expose an Electron Cookie alias for preload and renderer contracts'
  );
  assert.match(
    source,
    /export type AttendanceApprovalRequest = IAttendanceApproval/,
    'src/types.ts must expose a named attendance approval request payload'
  );
});

test('src/electron-env.d.ts uses named shared boundary results without any', () => {
  const source = readTrackedSource('src/electron-env.d.ts');

  assert.doesNotMatch(source, /\bany\b/, 'src/electron-env.d.ts must not contain explicit any');
  assert.match(source, /IpcResult/, 'src/electron-env.d.ts must use the shared IpcResult envelope');
  assert.match(source, /CookieList/, 'src/electron-env.d.ts must use the shared CookieList alias');
  assert.match(
    source,
    /startAttendanceApproval:\s*\(csrf:\s*string,\s*approval:\s*AttendanceApprovalRequest\)/,
    'startAttendanceApproval must accept the named approval request payload, not any'
  );
  assertNoPattern(
    'src/electron-env.d.ts',
    /from ['"]\.\/api['"]/,
    'src/electron-env.d.ts must not import API runtime modules for renderer globals'
  );
});

test('src/preload.ts is typed against IElectronAPI without widening callbacks or imports', () => {
  const source = readTrackedSource('src/preload.ts');

  assert.doesNotMatch(source, /\bany\b/, 'src/preload.ts must not contain explicit any');
  assert.match(
    source,
    /import type \{ IElectronAPI \} from ['"]\.\/electron-env['"]/,
    'src/preload.ts must import the preload contract as a type only'
  );
  assert.match(
    source,
    /const electronAPI:\s*IElectronAPI\s*=/,
    'src/preload.ts must type the exposed object against IElectronAPI'
  );
  assert.match(
    source,
    /ipcRenderer\.on\('cookies-updated',\s*\(\)\s*=>\s*\{\s*callback\(\);\s*\}\)/s,
    'onCookiesUpdated must wrap the Electron event and call the renderer callback with no arguments'
  );
  assertNoPattern(
    'src/preload.ts',
    /from ['"]\.\/api['"]/,
    'src/preload.ts must not import API runtime modules into the preload bundle'
  );
});

test('src/main-lib/cookie-store.ts keeps S01 inferrable string annotations removed', () => {
  assertNoPattern(
    'src/main-lib/cookie-store.ts',
    /lastCookiesHash:\s*string\s*=\s*''/,
    'cookie-store lastCookiesHash should rely on string literal inference'
  );
  assertNoPattern(
    'src/main-lib/cookie-store.ts',
    /restoreToSession\(partition:\s*string\s*=\s*['"]persist:mobile['"]\)/,
    'cookie-store restoreToSession default partition should rely on string literal inference'
  );
});

test('src/main-lib/ipc-handlers.ts keeps S01 inferrable boolean defaults removed', () => {
  assertNoPattern(
    'src/main-lib/ipc-handlers.ts',
    /clearOnFailure:\s*boolean\s*=\s*false/,
    'ipc-handlers verify-cookies clearOnFailure default should rely on boolean literal inference'
  );
});

test('src/modules/auth.ts keeps S01 inferrable boolean defaults removed', () => {
  assertNoPattern(
    'src/modules/auth.ts',
    /clearOnFailure:\s*boolean\s*=\s*false/,
    'auth verifyCookies clearOnFailure default should rely on boolean literal inference'
  );
});

test('src/renderer.ts keeps S01 inferrable boolean defaults removed', () => {
  assertNoPattern(
    'src/renderer.ts',
    /clearOnFailure:\s*boolean\s*=\s*false/,
    'renderer verifyCookiesAndShowInfo clearOnFailure default should rely on boolean literal inference'
  );
});

test('S02 source reader rejects ignored and runtime-only paths', () => {
  for (const deniedPath of ['.gsd/state.json', '.env', 'dist/main/index.js']) {
    assert.throws(
      () => readTrackedSource(deniedPath),
      /may only read tracked source\/package files/,
      `S02 contract test reader must reject ${deniedPath}`
    );
  }
});

test('S02 source reader fails loudly when an expected tracked file is missing', () => {
  const originalAllowedFile = 'src/__missing-s02-contract-file.ts';
  allowedFiles.add(originalAllowedFile);

  try {
    assert.throws(
      () => readTrackedSource(originalAllowedFile),
      /Expected source file is missing/,
      'Missing tracked source files must fail a named assertion'
    );
  } finally {
    allowedFiles.delete(originalAllowedFile);
  }
});
