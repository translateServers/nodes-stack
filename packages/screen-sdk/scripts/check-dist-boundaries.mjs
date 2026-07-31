// @ts-check
/* global process */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DIST_DIRECTORY = resolve(SCRIPT_DIRECTORY, '..', 'dist');
const FORBIDDEN_SOURCE_PATTERNS = [
  /apps\/web\//i,
  /features\/dataset\//i,
  /api\/core\//i,
  /node_modules\/.+axios/i,
  /node_modules\/.+sonner/i,
  /node_modules\/.+@tanstack[+/]react-(?:query|router)/i,
];

/** @param {string} directory @returns {string[]} */
function listSourceMaps(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return listSourceMaps(path);
    return entry.endsWith('.js.map') ? [path] : [];
  });
}

/** @param {string} source */
function normalizedSource(source) {
  return source.replaceAll('\\', '/');
}

/**
 * @param {string} [distRoot]
 * @returns {string[]}
 */
export function checkDistBoundaries(distRoot = DIST_DIRECTORY) {
  return listSourceMaps(distRoot).flatMap((filePath) => {
    /** @type {unknown} */
    const map = JSON.parse(readFileSync(filePath, 'utf8'));
    if (typeof map !== 'object' || map === null || !('sources' in map)) return [];
    const rawSources = map.sources;
    /** @type {unknown[]} */
    const sources = Array.isArray(rawSources) ? rawSources : [];
    return sources.flatMap((source) => {
      if (typeof source !== 'string') return [];
      const normalized = normalizedSource(source);
      return FORBIDDEN_SOURCE_PATTERNS.some((pattern) => pattern.test(normalized))
        ? [`${filePath}: forbidden production module: ${normalized}`]
        : [];
    });
  });
}

const invokedPath = process.argv[1] === undefined ? undefined : resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  const findings = checkDistBoundaries();
  if (findings.length > 0) {
    console.error(findings.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('screen-sdk production module graph: ok');
  }
}
