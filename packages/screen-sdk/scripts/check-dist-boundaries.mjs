// @ts-check
/* global process */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DIST_DIRECTORY = resolve(SCRIPT_DIRECTORY, '..', 'dist');
const FORBIDDEN_SOURCE_PATTERNS = [
  /apps\/web\//i,
  /features\/dataset\//i,
  /api\/core\//i,
  /node_modules\/(?:.*\/)?axios(?:\/|$)/i,
  /node_modules\/(?:.*\/)?@monaco-editor(?:\/|$)/i,
  /node_modules\/(?:.*\/)?monaco-editor(?:\/|$)/i,
  /node_modules\/(?:.*\/)?sonner(?:\/|$)/i,
  /node_modules\/(?:.*\/)?@tanstack[+/]react-(?:query|router)(?:\/|$)/i,
];
const FORBIDDEN_PACKAGES = new Set([
  '@monaco-editor/react',
  '@tanstack/react-query',
  '@tanstack/react-router',
  'axios',
  'monaco-editor',
  'sonner',
]);
const ALLOWED_DECLARATION_PACKAGES = new Set(['zod']);

/** @param {string} directory @returns {string[]} */
function listSourceMaps(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return listSourceMaps(path);
    return entry.endsWith('.js.map') ? [path] : [];
  });
}

/** @param {string} directory @returns {string[]} */
function listJavaScriptFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return listJavaScriptFiles(path);
    return entry.endsWith('.js') ? [path] : [];
  });
}

/** @param {string} directory @returns {string[]} */
function listDeclarationFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return listDeclarationFiles(path);
    return entry.endsWith('.d.ts') ? [path] : [];
  });
}

/** @param {string} source */
function normalizedSource(source) {
  return source.replaceAll('\\', '/');
}

/** @param {string} specifier */
function packageName(specifier) {
  if (!specifier.startsWith('@')) return specifier.split('/')[0] ?? specifier;
  return specifier.split('/').slice(0, 2).join('/');
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
    node.arguments.length >= 1 &&
    ts.isStringLiteral(node.arguments[0])
  ) {
    return node.arguments[0].text;
  }
  return undefined;
}

/**
 * @param {string} filePath
 * @param {string} source
 * @returns {{ findings: string[]; executable: boolean }}
 */
function inspectJavaScript(filePath, source) {
  /** @type {string[]} */
  const findings = [];
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );

  /** @param {import('typescript').Node} node */
  function visit(node) {
    const specifier = importSpecifier(node);
    if (specifier !== undefined && !specifier.startsWith('.') && !specifier.startsWith('/')) {
      if (
        specifier.startsWith('@/') ||
        specifier.startsWith('@nebula/web') ||
        specifier.includes('apps/web') ||
        FORBIDDEN_PACKAGES.has(packageName(specifier))
      ) {
        findings.push(`${filePath}: forbidden production import: ${specifier}`);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return {
    findings,
    executable: sourceFile.statements.some(
      (statement) =>
        !ts.isImportDeclaration(statement) &&
        !ts.isExportDeclaration(statement) &&
        !ts.isEmptyStatement(statement),
    ),
  };
}

/**
 * @param {string} filePath
 * @param {string} source
 * @returns {string[]}
 */
function inspectDeclarations(filePath, source) {
  /** @type {string[]} */
  const findings = [];
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  /** @param {import('typescript').Node} node */
  function visit(node) {
    const specifier = importSpecifier(node);
    if (specifier !== undefined && !specifier.startsWith('.') && !specifier.startsWith('/')) {
      const name = packageName(specifier);
      if (!ALLOWED_DECLARATION_PACKAGES.has(name)) {
        findings.push(`${filePath}: forbidden public declaration import: ${specifier}`);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

/**
 * @param {string} [distRoot]
 * @returns {string[]}
 */
export function checkDistBoundaries(distRoot = DIST_DIRECTORY) {
  const mapFindings = listSourceMaps(distRoot).flatMap((filePath) => {
    /** @type {unknown} */
    const map = JSON.parse(readFileSync(filePath, 'utf8'));
    if (typeof map !== 'object' || map === null || !('sources' in map)) {
      return [`${filePath}: production sourcemap must contain sources`];
    }
    const rawSources = map.sources;
    const sources = Array.isArray(rawSources)
      ? rawSources.filter((source) => typeof source === 'string')
      : [];
    if (sources.length === 0)
      return [`${filePath}: production sourcemap sources must not be empty`];
    return sources.flatMap((source) => {
      const normalized = normalizedSource(source);
      return FORBIDDEN_SOURCE_PATTERNS.some((pattern) => pattern.test(normalized))
        ? [`${filePath}: forbidden production module: ${normalized}`]
        : [];
    });
  });
  const javaScriptFindings = listJavaScriptFiles(distRoot).flatMap((filePath) => {
    const source = readFileSync(filePath, 'utf8');
    const inspected = inspectJavaScript(filePath, source);
    if (!existsSync(`${filePath}.map`) && inspected.executable) {
      inspected.findings.push(`${filePath}: executable production chunk is missing a sourcemap`);
    }
    return inspected.findings;
  });
  const declarationFindings = listDeclarationFiles(distRoot).flatMap((filePath) =>
    inspectDeclarations(filePath, readFileSync(filePath, 'utf8')),
  );
  return [...mapFindings, ...javaScriptFindings, ...declarationFindings];
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
