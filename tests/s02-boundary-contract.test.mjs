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
  'src/renderer.ts',
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
