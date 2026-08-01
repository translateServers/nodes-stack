// @ts-check
/* global process */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PNPM_EXEC_PATH = process.env['npm_execpath'];

/** @param {string[]} args @param {string} cwd */
function runPnpm(args, cwd) {
  const command = PNPM_EXEC_PATH === undefined ? 'pnpm' : process.execPath;
  const commandArgs = PNPM_EXEC_PATH === undefined ? args : [PNPM_EXEC_PATH, ...args];
  const result = spawnSync(command, commandArgs, { cwd, encoding: 'utf8', stdio: 'pipe' });
  if (result.status === 0) return;
  throw new Error(
    [`pnpm ${args.join(' ')} failed`, result.error?.message, result.stdout, result.stderr]
      .filter(Boolean)
      .join('\n'),
  );
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
function listFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return listFiles(path);
    return [path];
  });
}

/**
 * @param {string} filePath
 * @returns {{ executable: boolean; specifiers: Array<{ dynamic: boolean; value: string }> }}
 */
function inspectJavaScript(filePath) {
  const sourceFile = ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  /** @type {Array<{ dynamic: boolean; value: string }>} */
  const specifiers = [];

  /** @param {import('typescript').Node} node */
  function visit(node) {
    let specifier;
    let dynamic = false;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      specifier =
        node.moduleSpecifier !== undefined && ts.isStringLiteral(node.moduleSpecifier)
          ? node.moduleSpecifier.text
          : undefined;
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length >= 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifier = node.arguments[0].text;
      dynamic = true;
    }
    if (specifier !== undefined) specifiers.push({ dynamic, value: specifier });
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return {
    executable: sourceFile.statements.some(
      (statement) =>
        !ts.isImportDeclaration(statement) &&
        !ts.isExportDeclaration(statement) &&
        !ts.isEmptyStatement(statement),
    ),
    specifiers,
  };
}

const consumerRoot = mkdtempSync(join(tmpdir(), 'nebula-screen-sdk-consumer-'));
try {
  runPnpm(['build'], PACKAGE_ROOT);
  runPnpm(['pack', '--pack-destination', consumerRoot], PACKAGE_ROOT);
  const tarballName = readdirSync(consumerRoot).find((entry) => entry.endsWith('.tgz'));
  if (tarballName === undefined) throw new Error('SDK tarball was not created');
  const tarballPath = join(consumerRoot, tarballName).replaceAll('\\', '/');
  const sourceRoot = join(consumerRoot, 'src');
  mkdirSync(sourceRoot);

  writeFileSync(
    join(consumerRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: 'nebula-screen-sdk-consumer',
        private: true,
        type: 'module',
        scripts: { build: 'tsc --noEmit && vite build' },
        dependencies: { '@nebula/screen-sdk': `file:${tarballPath}` },
        devDependencies: { typescript: '^6.0.3', vite: '^8.0.0' },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(consumerRoot, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          lib: ['ES2023', 'DOM'],
          module: 'ESNext',
          moduleResolution: 'bundler',
          noEmit: true,
          resolveJsonModule: true,
          strict: true,
          target: 'ES2023',
        },
        include: ['src/**/*.ts'],
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(consumerRoot, 'index.html'),
    '<!doctype html><html><body><script type="module" src="/src/main.ts"></script></body></html>\n',
  );
  writeFileSync(
    join(sourceRoot, 'main.ts'),
    `import '@nebula/screen-sdk/auto-register';
import type { ScreenHostAdapter } from '@nebula/screen-sdk';
import { ScreenDocumentV1Schema } from '@nebula/screen-sdk/contracts';
import screenDocumentSchema from '@nebula/screen-sdk/contracts/screen-document.schema.json';

void ScreenDocumentV1Schema;
void screenDocumentSchema;

const adapter: ScreenHostAdapter = {
  loadProject: async ({ projectId }) => ({
    id: projectId,
    name: 'Consumer project',
    description: null,
    status: 'draft',
    revision: '1',
    document: {
      schemaVersion: 1,
      canvas: {
        width: 1920,
        height: 1080,
        backgroundColor: '#000000',
        scaleMode: 'fit',
      },
      components: [],
      globalVariables: [],
    },
  }),
  saveProject: async ({ projectId, draft }) => ({
    id: projectId,
    status: 'draft',
    revision: '2',
    ...draft,
  }),
};

const editor = document.createElement('nebula-screen-editor');
editor.adapter = adapter;
editor.projectId = 'consumer-project';
document.body.append(editor);
`,
  );

  runPnpm(['install', '--ignore-workspace'], consumerRoot);
  runPnpm(['build'], consumerRoot);

  const installedManifestPath = join(
    consumerRoot,
    'node_modules',
    '@nebula',
    'screen-sdk',
    'package.json',
  );
  if (!existsSync(installedManifestPath)) throw new Error('Packed SDK was not installed');
  const installedPackageRoot = dirname(installedManifestPath);
  const packageEntries = readdirSync(installedPackageRoot).sort();
  if (JSON.stringify(packageEntries) !== JSON.stringify(['dist', 'package.json'])) {
    throw new Error(`Packed SDK root contains unexpected entries: ${packageEntries.join(', ')}`);
  }

  const installedDistRoot = join(installedPackageRoot, 'dist');
  const javaScriptInspections = listJavaScriptFiles(installedDistRoot).map((filePath) => ({
    filePath,
    ...inspectJavaScript(filePath),
  }));
  const bareImports = javaScriptInspections.flatMap(({ filePath, specifiers }) =>
    specifiers
      .filter(({ value }) => !value.startsWith('.') && !value.startsWith('/'))
      .map(({ value }) => `${filePath}: ${value}`),
  );
  if (bareImports.length > 0) {
    throw new Error(`Packed SDK contains bare runtime imports:\n${bareImports.join('\n')}`);
  }

  const unresolvedImports = javaScriptInspections.flatMap(({ filePath, specifiers }) =>
    specifiers.flatMap(({ value }) => {
      if (!value.startsWith('.')) return [];
      const target = resolve(dirname(filePath), value.replace(/[?#].*$/u, ''));
      return existsSync(target) ? [] : [`${filePath}: ${value}`];
    }),
  );
  if (unresolvedImports.length > 0) {
    throw new Error(
      `Packed SDK contains unresolved relative imports:\n${unresolvedImports.join('\n')}`,
    );
  }

  const dynamicImports = javaScriptInspections.flatMap(({ specifiers }) =>
    specifiers.filter(({ dynamic }) => dynamic).map(({ value }) => value),
  );
  for (const expectedChunk of ['blueprint-sheet-v2', 'static-runtime']) {
    if (!dynamicImports.some((specifier) => specifier.includes(expectedChunk))) {
      throw new Error(`Packed SDK is missing the ${expectedChunk} dynamic chunk import`);
    }
  }

  for (const { executable, filePath } of javaScriptInspections) {
    if (!executable) continue;
    const sourceMapPath = `${filePath}.map`;
    if (!existsSync(sourceMapPath)) {
      throw new Error(`Packed executable is missing a source map: ${filePath}`);
    }
    /** @type {unknown} */
    const sourceMapValue = JSON.parse(readFileSync(sourceMapPath, 'utf8'));
    const sourceMap =
      typeof sourceMapValue === 'object' && sourceMapValue !== null
        ? /** @type {Record<string, unknown>} */ (sourceMapValue)
        : {};
    const sources = sourceMap['sources'];
    const sourcesContent = sourceMap['sourcesContent'];
    if (
      !Array.isArray(sources) ||
      sources.length === 0 ||
      !Array.isArray(sourcesContent) ||
      sourcesContent.length !== sources.length ||
      sourcesContent.some((source) => typeof source !== 'string')
    ) {
      throw new Error(`Packed source map is incomplete: ${sourceMapPath}`);
    }
  }

  const runtimeAssetText = listFiles(installedDistRoot)
    .filter((filePath) => /\.(?:css|js)$/u.test(filePath))
    .map((filePath) => readFileSync(filePath, 'utf8'))
    .join('\n');
  if (!runtimeAssetText.includes('Geist Variable')) {
    throw new Error('Packed SDK does not declare the Geist Variable font family');
  }
  if (!/data:font\/woff2;base64,/u.test(runtimeAssetText)) {
    throw new Error('Packed SDK does not contain embedded WOFF2 font resources');
  }

  /** @type {unknown} */
  const installedManifest = JSON.parse(readFileSync(installedManifestPath, 'utf8'));
  const manifest =
    typeof installedManifest === 'object' && installedManifest !== null
      ? /** @type {Record<string, unknown>} */ (installedManifest)
      : {};
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    const dependencies = manifest[field];
    if (typeof dependencies === 'object' && dependencies !== null) {
      const names = Object.keys(dependencies).sort();
      const expected = field === 'dependencies' ? ['zod'] : [];
      if (JSON.stringify(names) !== JSON.stringify(expected)) {
        throw new Error(
          `Packed SDK has unexpected ${field}: ${names.length > 0 ? names.join(', ') : '(none)'}`,
        );
      }
    }
  }
  console.log('screen-sdk tarball consumer, chunks, fonts, and source maps: ok');
} finally {
  rmSync(consumerRoot, { recursive: true, force: true });
}
