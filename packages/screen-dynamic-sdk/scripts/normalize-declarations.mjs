// @ts-check
/* global process */

/**
 * 声明文件规范化（screen-dynamic-sdk）。
 *
 * vite-plugin-dts 会为每个入口生成 d.ts；本脚本校验声明入口齐全。
 * 声明文件路径与 package.json exports 对齐。
 */

import { accessSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DIST_ROOT = resolve(SCRIPT_DIRECTORY, '..', 'dist');

const EXPECTED_DTS = [
  'index.d.ts',
  'auto-register.d.ts',
  'contracts/index.d.ts',
  'testing/index.d.ts',
];

/** @param {string} directory @returns {string[]} */
function dtsFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    if (statSync(path).isDirectory()) return dtsFiles(path);
    return entry.endsWith('.d.ts') ? [entry] : [];
  });
}

const missing = EXPECTED_DTS.filter((entry) => {
  try {
    accessSync(resolve(DIST_ROOT, entry));
    return false;
  } catch {
    return true;
  }
});

if (missing.length > 0) {
  console.error(`missing declarations: ${missing.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log(`declarations ok (${dtsFiles(DIST_ROOT).length} .d.ts files)`);
}
