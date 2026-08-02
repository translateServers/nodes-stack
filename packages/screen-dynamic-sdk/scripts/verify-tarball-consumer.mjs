// @ts-check
/* global process */

/**
 * screen-dynamic-sdk tarball 验证（轻量）。
 *
 * 1. `pnpm pack` 生成 tarball
 * 2. 检查 tarball 包含关键入口（dist/index.js / dist/auto-register.js / d.ts）
 * 3. 输出 tarball 路径供 CI 消费
 *
 * 完整 Vue 3 消费者验证由 apps/dynamic-sdk-vue-consumer（Playwright smoke）承担。
 */

import { spawnSync } from 'node:child_process';
import { accessSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(SCRIPT_DIRECTORY, '..');

const isWindows = process.platform === 'win32';

/** @param {string[]} args @param {import('node:child_process').SpawnSyncOptions} [options] */
function run(args, options) {
  const result = spawnSync(isWindows ? 'pnpm' : 'pnpm', args, {
    cwd: PACKAGE_ROOT,
    encoding: 'utf8',
    shell: isWindows,
    ...options,
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    throw new Error(`command failed: pnpm ${args.join(' ')}`);
  }
  return result.stdout ?? '';
}

const output = run(['pack', '--pack-destination', tmpdir()], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
const tarball = output.trim().split('\n').filter(Boolean).at(-1)?.trim();

if (tarball === undefined || !tarball.endsWith('.tgz')) {
  console.error('pnpm pack 未产出 tarball');
  process.exit(1);
}

const tempDir = mkdtempSync(resolve(tmpdir(), 'screen-dynamic-sdk-tarball-'));
try {
  run(['exec', 'tar', '-xzf', tarball, '-C', tempDir], { stdio: 'inherit' });
  const packageDir = resolve(tempDir, 'package');
  const required = [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/auto-register.js',
    'dist/auto-register.d.ts',
    'dist/contracts/index.js',
    'dist/contracts/index.d.ts',
    'dist/testing/index.js',
    'dist/testing/index.d.ts',
  ];
  const missing = required.filter((entry) => {
    try {
      accessSync(resolve(packageDir, entry));
      return false;
    } catch {
      return true;
    }
  });
  if (missing.length > 0) {
    console.error(`tarball 缺少入口: ${missing.join(', ')}`);
    process.exit(1);
  }
  console.log(`tarball 验证通过: ${tarball}`);
  console.log(`包含入口: ${required.join(', ')}`);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
  try {
    rmSync(tarball, { force: true });
  } catch {
    // 清理失败不影响结果
  }
}
