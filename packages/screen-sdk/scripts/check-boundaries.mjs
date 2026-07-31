// @ts-check
/* global process */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(SCRIPT_DIRECTORY, '..');
export const SOURCE_ROOT = resolve(PACKAGE_ROOT, 'src');
export const CORE_SOURCE_ROOT = resolve(PACKAGE_ROOT, '../screen-editor-core/src');

const FORBIDDEN_PACKAGES = new Set([
  '@tanstack/react-query',
  '@tanstack/react-router',
  'axios',
  'sonner',
]);

/** @param {string} specifier */
function packageName(specifier) {
  if (!specifier.startsWith('@')) return specifier.split('/')[0] ?? specifier;
  return specifier.split('/').slice(0, 2).join('/');
}

/**
 * @param {string} root
 * @param {string} target
 */
function isInside(root, target) {
  const pathFromRoot = relative(root, target);
  return pathFromRoot === '' || (!pathFromRoot.startsWith('..') && !isAbsolute(pathFromRoot));
}

/** @param {import('typescript').Node} node */
function importSpecifier(node) {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
    return node.moduleSpecifier !== undefined && ts.isStringLiteral(node.moduleSpecifier)
      ? node.moduleSpecifier.text
      : undefined;
  }
  if (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword &&
    node.arguments.length === 1 &&
    ts.isStringLiteral(node.arguments[0])
  ) {
    return node.arguments[0].text;
  }
  return undefined;
}

/** @param {import('typescript').Node} node */
function isBusinessFetchCall(node) {
  if (!ts.isCallExpression(node)) return false;
  if (ts.isIdentifier(node.expression)) return node.expression.text === 'fetch';
  if (!ts.isPropertyAccessExpression(node.expression) || node.expression.name.text !== 'fetch') {
    return false;
  }
  const owner = node.expression.expression;
  return ts.isIdentifier(owner) && ['window', 'globalThis'].includes(owner.text);
}

/**
 * @param {string} filePath
 * @param {string} source
 * @param {string} [sourceRoot]
 * @returns {string[]}
 */
export function inspectSource(filePath, source, sourceRoot = SOURCE_ROOT) {
  /** @type {string[]} */
  const findings = [];
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    extname(filePath) === '.tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  /** @param {import('typescript').Node} node */
  function visit(node) {
    const specifier = importSpecifier(node);
    if (specifier !== undefined) {
      if (specifier.startsWith('@/') || specifier.startsWith('@nebula/web')) {
        findings.push(`${filePath}: application alias is forbidden: ${specifier}`);
      } else if (specifier.includes('apps/web')) {
        findings.push(`${filePath}: application source import is forbidden: ${specifier}`);
      } else if (!specifier.startsWith('.') && FORBIDDEN_PACKAGES.has(packageName(specifier))) {
        findings.push(`${filePath}: host package is forbidden: ${specifier}`);
      } else if (specifier.startsWith('.')) {
        const target = resolve(dirname(filePath), specifier);
        if (!isInside(sourceRoot, target)) {
          findings.push(`${filePath}: relative import escapes SDK src: ${specifier}`);
        }
      }
    }
    if (isBusinessFetchCall(node)) {
      findings.push(`${filePath}: SDK production source must not call fetch directly`);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

/**
 * @param {string} directory
 * @returns {string[]}
 */
function sourceFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    if (!/\.[cm]?[jt]sx?$/.test(entry) || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry)) return [];
    return [path];
  });
}

/**
 * @param {string} [sourceRoot]
 * @returns {string[]}
 */
export function checkBoundaries(sourceRoot) {
  const sourceRoots = sourceRoot === undefined ? [SOURCE_ROOT, CORE_SOURCE_ROOT] : [sourceRoot];
  return sourceRoots.flatMap((root) =>
    sourceFiles(root).flatMap((filePath) =>
      inspectSource(filePath, readFileSync(filePath, 'utf8'), root),
    ),
  );
}

const invokedPath = process.argv[1] === undefined ? undefined : resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  const findings = checkBoundaries();
  if (findings.length > 0) {
    console.error(findings.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('screen-sdk boundaries: ok');
  }
}
