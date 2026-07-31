// @ts-check
/* global process */

/**
 * Post-build cleanup for SDK declaration files.
 *
 * The Vite virtual module `virtual:nebula-screen-editor-runtime` is an internal
 * build-time mechanism (resolved by runtime-plugin.ts). Its ambient module
 * declaration must NOT leak into the public .d.ts output, because consumers
 * never need to (and cannot) import from that virtual specifier.
 *
 * This script strips any `declare module 'virtual:nebula-screen-editor-runtime'`
 * blocks (including preceding comments) from all generated .d.ts files.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DIST_DIRECTORY = resolve(SCRIPT_DIRECTORY, '..', 'dist');

const VIRTUAL_MODULE_PATTERN = /virtual:nebula-screen-editor-runtime/;
const BLOCK_PATTERN = /\n*(?:\/\/[^\n]*\n)*\s*declare module ['"]virtual:nebula-screen-editor-runtime['"]\s*\{[^}]*\}\s*/g;

/** @param {string} directory @returns {string[]} */
function listDeclarationFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return listDeclarationFiles(path);
    return entry.endsWith('.d.ts') ? [path] : [];
  });
}

/** @param {string} filePath */
function stripVirtualModule(filePath) {
  const original = readFileSync(filePath, 'utf8');
  if (!VIRTUAL_MODULE_PATTERN.test(original)) return false;
  const cleaned = original.replace(BLOCK_PATTERN, '\n');
  if (cleaned === original) return false;
  writeFileSync(filePath, cleaned, 'utf8');
  return true;
}

const invokedPath = process.argv[1] === undefined ? undefined : resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  const files = listDeclarationFiles(DIST_DIRECTORY);
  const cleaned = files.filter(stripVirtualModule);
  if (cleaned.length > 0) {
    console.log(`stripped virtual module declaration from ${cleaned.length} file(s):`);
    for (const file of cleaned) {
      console.log(`  ${file}`);
    }
  } else {
    console.log('no virtual module declarations found');
  }
}
