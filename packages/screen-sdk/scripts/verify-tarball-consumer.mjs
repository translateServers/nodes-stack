// @ts-check
/* global process */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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

const consumerRoot = mkdtempSync(join(tmpdir(), 'nebula-screen-sdk-consumer-'));
try {
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
  /** @type {unknown} */
  const installedManifest = JSON.parse(readFileSync(installedManifestPath, 'utf8'));
  const dependencies =
    typeof installedManifest === 'object' &&
    installedManifest !== null &&
    'dependencies' in installedManifest &&
    typeof installedManifest.dependencies === 'object' &&
    installedManifest.dependencies !== null
      ? installedManifest.dependencies
      : {};
  if (Object.hasOwn(dependencies, '@nebula/screen-editor-core')) {
    throw new Error('Packed SDK exposes the private core package as a consumer dependency');
  }
  console.log('screen-sdk tarball consumer: ok');
} finally {
  rmSync(consumerRoot, { recursive: true, force: true });
}
