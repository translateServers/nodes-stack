// @ts-check
/* global process */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DIST_DIRECTORY = resolve(SCRIPT_DIRECTORY, '..', 'dist');
const MAX_TOTAL_GZIP_BYTES = 1_000_000;

/** @param {string} directory @returns {string[]} */
function listRuntimeAssets(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    if (statSync(path).isDirectory()) return listRuntimeAssets(path);
    return /\.(?:css|js)$/.test(entry) ? [path] : [];
  });
}

/** @param {number} bytes */
function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

const assets = listRuntimeAssets(DIST_DIRECTORY)
  .map((path) => {
    const source = readFileSync(path);
    return {
      path: relative(DIST_DIRECTORY, path).replaceAll('\\', '/'),
      raw: source.byteLength,
      gzip: gzipSync(source, { level: 9 }).byteLength,
    };
  })
  .sort((left, right) => left.path.localeCompare(right.path));

const totals = assets.reduce(
  (result, asset) => ({ raw: result.raw + asset.raw, gzip: result.gzip + asset.gzip }),
  { raw: 0, gzip: 0 },
);

for (const asset of assets) {
  console.log(`${asset.path}: ${formatBytes(asset.raw)} raw, ${formatBytes(asset.gzip)} gzip`);
}
console.log(`total: ${formatBytes(totals.raw)} raw, ${formatBytes(totals.gzip)} gzip`);
console.log(`gzip limit: ${formatBytes(MAX_TOTAL_GZIP_BYTES)}`);

if (totals.gzip > MAX_TOTAL_GZIP_BYTES) {
  console.error(
    `screen-sdk gzip size ${totals.gzip} exceeds the ${MAX_TOTAL_GZIP_BYTES} byte limit`,
  );
  process.exitCode = 1;
}
