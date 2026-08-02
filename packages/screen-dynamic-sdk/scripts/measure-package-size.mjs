// @ts-check
/* global process */

/**
 * screen-dynamic-sdk gzip 体积基线检查。
 *
 * 预算（阶段 0 冻结）：全量入口 gzip ≤ 900 KiB。
 * 输出 dist 各入口 gzip 与合计，超预算退出码 1。
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DIST_ROOT = resolve(SCRIPT_DIRECTORY, '..', 'dist');
const BUDGET_BYTES = 900 * 1024;

/** @param {string} directory @returns {string[]} */
function distFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    if (statSync(path).isDirectory()) return distFiles(path);
    if (entry.endsWith('.js') || entry.endsWith('.mjs')) return [path];
    return [];
  });
}

const files = distFiles(DIST_ROOT);
let total = 0;
for (const file of files) {
  const bytes = gzipSync(readFileSync(file)).byteLength;
  total += bytes;
  console.log(`${relative(DIST_ROOT, file).padEnd(70)} ${(bytes / 1024).toFixed(1)} KiB`);
}

console.log(
  `total gzip: ${(total / 1024).toFixed(1)} KiB (budget ${(BUDGET_BYTES / 1024).toFixed(1)} KiB)`,
);
if (total > BUDGET_BYTES) {
  console.error(`size budget exceeded: ${total} > ${BUDGET_BYTES}`);
  process.exitCode = 1;
} else {
  console.log('screen-dynamic-sdk size budget: ok');
}
