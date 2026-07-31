// @ts-check
/* global process */

/**
 * Normalize generated SDK declaration entrypoints.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DIST_DIRECTORY = resolve(SCRIPT_DIRECTORY, '..', 'dist');

const ELEMENT_TAG_MAP_BLOCK_PATTERN =
  /\n*\s*declare global\s*\{\s*interface HTMLElementTagNameMap\s*\{\s*'nebula-screen-editor': NebulaScreenEditorElement;\s*\}\s*\}\s*/g;
const ELEMENT_TAG_MAP_DECLARATION = `
declare global {
    interface HTMLElementTagNameMap {
        'nebula-screen-editor': NebulaScreenEditorElement;
    }
}
`;

/** @param {string} directory @returns {string[]} */
function listDeclarationFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return listDeclarationFiles(path);
    return entry.endsWith('.d.ts') ? [path] : [];
  });
}

/** @param {string} filePath */
function cleanDeclarationFile(filePath) {
  const original = readFileSync(filePath, 'utf8');
  const normalizedPath = filePath.replaceAll('\\', '/');
  const withoutElementTagMap = original.replace(ELEMENT_TAG_MAP_BLOCK_PATTERN, '\n');
  const hasElementTagMap = withoutElementTagMap !== original;
  let cleaned = withoutElementTagMap;

  if (normalizedPath.endsWith('contracts/index.d.ts')) {
    cleaned = withoutElementTagMap;
  } else if (hasElementTagMap && normalizedPath.endsWith('auto-register.d.ts')) {
    cleaned = `import type { NebulaScreenEditorElement } from './index.js';\n${cleaned}${ELEMENT_TAG_MAP_DECLARATION}`;
  } else if (hasElementTagMap && normalizedPath.endsWith('/dist/index.d.ts')) {
    cleaned = `${cleaned}${ELEMENT_TAG_MAP_DECLARATION}`;
  }
  if (cleaned === original) return false;
  writeFileSync(filePath, cleaned, 'utf8');
  return true;
}

const invokedPath = process.argv[1] === undefined ? undefined : resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  const files = listDeclarationFiles(DIST_DIRECTORY);
  const cleaned = files.filter(cleanDeclarationFile);
  if (cleaned.length > 0) {
    console.log(`cleaned ${cleaned.length} generated declaration file(s):`);
    for (const file of cleaned) {
      console.log(`  ${file}`);
    }
  } else {
    console.log('generated declaration files already clean');
  }
}
