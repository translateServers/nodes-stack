// @ts-check
/* global process */

import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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

const consumerRoot = mkdtempSync(join(tmpdir(), 'nebula-screen-component-sdk-consumer-'));
try {
  runPnpm(['build'], PACKAGE_ROOT);
  runPnpm(['pack', '--pack-destination', consumerRoot], PACKAGE_ROOT);
  const tarballName = readdirSync(consumerRoot).find((entry) => entry.endsWith('.tgz'));
  if (tarballName === undefined) throw new Error('component SDK tarball was not created');
  const tarballPath = join(consumerRoot, tarballName).replaceAll('\\', '/');
  const sourceRoot = join(consumerRoot, 'src');
  mkdirSync(sourceRoot);

  writeFileSync(
    join(consumerRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: 'nebula-screen-component-sdk-consumer',
        private: true,
        type: 'module',
        scripts: { build: 'tsc --noEmit' },
        dependencies: { '@nebula/screen-component-sdk': `file:${tarballPath}` },
        devDependencies: { typescript: '^6.0.3' },
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
    join(sourceRoot, 'main.ts'),
    `import {
  SCREEN_COMPONENT_API_VERSION,
  defineScreenComponent,
  validateManifest,
  type ScreenComponentElementModelV1,
  type ScreenComponentManifestV1,
} from '@nebula/screen-component-sdk';
import { createMinimalManifest, expectManifestOk } from '@nebula/screen-component-sdk/testing';

class ConsumerMetricCard extends HTMLElement {
  set model(value: ScreenComponentElementModelV1) {
    this.textContent = String(value.props['title'] ?? 'Metric');
  }
}

const manifest: ScreenComponentManifestV1 = {
  apiVersion: SCREEN_COMPONENT_API_VERSION,
  type: 'consumer.metric-card/v1',
  implementationVersion: '1.0.0',
  tagName: 'consumer-metric-card-v1',
  name: 'Metric Card',
  category: 'chart',
  defaultSize: { width: 240, height: 120 },
  defaultProps: { title: 'Revenue', value: 42 },
  propsSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      value: { type: 'number' },
    },
    required: ['title', 'value'],
  },
  events: [{ id: 'valueClick', name: 'Value Click' }],
};

const plugin = defineScreenComponent({ manifest, define: () => ConsumerMetricCard });
const validation = validateManifest(plugin.manifest);
if (!validation.ok) throw new Error(validation.diagnostics[0]?.message ?? 'invalid manifest');
expectManifestOk(createMinimalManifest());
`,
  );

  runPnpm(['install', '--ignore-workspace'], consumerRoot);
  runPnpm(['build'], consumerRoot);
  console.log('screen-component-sdk tarball consumer: ok');
} finally {
  rmSync(consumerRoot, { recursive: true, force: true });
}
