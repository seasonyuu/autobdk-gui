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
  'src/main-lib/cookie-store.ts',
  'src/main-lib/ipc-handlers.ts',
  'src/modules/auth.ts',
  'src/modules/checkin/analyzer.ts',
  'src/modules/checkin/executor.ts',
  'tests/s04-failure-visibility-contract.test.mjs',
]);

function readTrackedSource(relativePath) {
  assert.equal(
    allowedFiles.has(relativePath),
    true,
    `S04 contract tests may only read tracked source/package files, got ${relativePath}`
  );

  const absolutePath = path.resolve(projectRoot, relativePath);
  assert.equal(
    absolutePath.startsWith(projectRoot + path.sep),
    true,
    `S04 contract path must stay inside project root: ${relativePath}`
  );
  assert.equal(existsSync(absolutePath), true, `Expected source file is missing: ${relativePath}`);

  return readFileSync(absolutePath, 'utf8');
}

function assertSourceContains(relativePath, pattern, message) {
  assert.match(readTrackedSource(relativePath), pattern, message);
}

function assertSourceDoesNotContain(relativePath, pattern, message) {
  assert.doesNotMatch(readTrackedSource(relativePath), pattern, message);
}

test('package.json exposes the S04 static failure-visibility script', () => {
  const packageJson = JSON.parse(readTrackedSource('package.json'));

  assert.equal(
    packageJson.scripts?.['test:s04'],
    'node --test tests/s04-failure-visibility-contract.test.mjs',
    'package.json must expose npm run test:s04 without external dependencies'
  );
});

test('S04 source reader rejects ignored and runtime-only paths', () => {
  for (const deniedPath of ['.gsd/state.json', '.env', 'dist/main/index.js', 'webview-cookies.json']) {
    assert.throws(
      () => readTrackedSource(deniedPath),
      /may only read tracked source\/package files/,
      `S04 contract test reader must reject ${deniedPath}`
    );
  }
});

test('src/modules/checkin/executor.ts validates new-sign-again config before approval payload construction', () => {
  assertSourceContains(
    'src/modules/checkin/executor.ts',
    /validateNewSignAgainConfig|assertValidSignAgainConfig/,
    'check-in executor must use a named helper to validate new-sign-again config'
  );
  assertSourceContains(
    'src/modules/checkin/executor.ts',
    /补签配置不完整|补签配置无效|缺少部门/,
    'malformed check-in config must produce a stable user-readable non-secret error'
  );
});

test('src/modules/checkin/executor.ts preserves non-destructive approval verification boundary', () => {
  const testSource = readTrackedSource('tests/s04-failure-visibility-contract.test.mjs');
  const prohibitedLiveCall = 'window.electronAPI?.' + 'startAttendanceApproval';

  assert.equal(
    testSource.includes(prohibitedLiveCall),
    false,
    'S04 contract tests must not call the live attendance approval IPC path'
  );
  assertSourceContains(
    'src/modules/checkin/executor.ts',
    /startAttendanceApproval/,
    'static checks may inspect the approval path but must not execute it'
  );
});

test('src/modules/checkin/analyzer.ts exposes malformed attendance detail diagnostics', () => {
  assertSourceContains(
    'src/modules/checkin/analyzer.ts',
    /reportMalformedAttendanceDetail|warnMalformedAttendanceDetail/,
    'attendance analyzer must route malformed detail responses through a named diagnostic helper'
  );
  assertSourceContains(
    'src/modules/checkin/analyzer.ts',
    /Malformed attendance detail response|考勤详情数据异常|考勤详情缺失/,
    'malformed attendance detail responses must have a stable non-secret diagnostic message'
  );
});

test('auth, Cookie, IPC, and API diagnostics avoid obvious secret value logging', () => {
  const redactionTargets = [
    'src/api.ts',
    'src/main-lib/cookie-store.ts',
    'src/main-lib/ipc-handlers.ts',
    'src/modules/auth.ts',
    'src/modules/checkin/analyzer.ts',
    'src/modules/checkin/executor.ts',
  ];
  const forbiddenSecretLogging = /console\.(?:log|warn|error)\([^\n]*(?:cookieString|csrf|X-CSRF-TOKEN|Cookie:|approval|data:)\b/i;

  for (const relativePath of redactionTargets) {
    assertSourceDoesNotContain(
      relativePath,
      forbiddenSecretLogging,
      `${relativePath} must not log Cookie values, CSRF tokens, approval payloads, or request bodies`
    );
  }
});

test('IPC failure surfaces preserve shared non-secret error envelopes', () => {
  const source = readTrackedSource('src/main-lib/ipc-handlers.ts');

  assert.match(source, /success:\s*false,\s*error:/, 'IPC handlers must preserve error envelopes for failed calls');
  assert.match(source, /Unauthorized IPC sender/, 'S04 must preserve the S03 unauthorized IPC failure surface');
});
