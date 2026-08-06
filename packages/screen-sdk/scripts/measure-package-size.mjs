// @ts-check
/* global process */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DIST_DIRECTORY = resolve(SCRIPT_DIRECTORY, '..', 'dist');
const MAX_VARIANT_GZIP_BYTES = 1_000_000;

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

/** @param {string} path */
function isReactRuntimeAsset(path) {
  return path === 'react.js' || path.startsWith('react/');
}

/** @param {Array<{ raw: number; gzip: number }>} assets */
function totalSize(assets) {
  return assets.reduce(
    (result, asset) => ({ raw: result.raw + asset.raw, gzip: result.gzip + asset.gzip }),
    { raw: 0, gzip: 0 },
  );
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

const defaultRuntimeAssets = assets.filter(({ path }) => !isReactRuntimeAsset(path));
const reactRuntimeAssets = assets.filter(({ path }) => isReactRuntimeAsset(path));
const totals = totalSize(assets);
const runtimeVariants = [
  { name: 'default', assets: defaultRuntimeAssets, totals: totalSize(defaultRuntimeAssets) },
  { name: 'react', assets: reactRuntimeAssets, totals: totalSize(reactRuntimeAssets) },
];

for (const runtime of runtimeVariants) {
  for (const asset of runtime.assets) {
    console.log(`${asset.path}: ${formatBytes(asset.raw)} raw, ${formatBytes(asset.gzip)} gzip`);
  }
  console.log(
    `${runtime.name} runtime: ${formatBytes(runtime.totals.raw)} raw, ${formatBytes(runtime.totals.gzip)} gzip`,
  );
  console.log(`${runtime.name} gzip limit: ${formatBytes(MAX_VARIANT_GZIP_BYTES)}`);
  if (runtime.assets.length > 0 && runtime.totals.gzip > MAX_VARIANT_GZIP_BYTES) {
    console.error(
      `screen-sdk ${runtime.name} runtime gzip size ${runtime.totals.gzip} exceeds the ${MAX_VARIANT_GZIP_BYTES} byte limit`,
    );
    process.exitCode = 1;
  }
}
console.log(
  `combined package runtime: ${formatBytes(totals.raw)} raw, ${formatBytes(totals.gzip)} gzip`,
);
