import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkDistBoundaries } from '../scripts/check-dist-boundaries.mjs';

const tempRoots: string[] = [];

function makeSourcemapFixture(sources: string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'nebula-dist-boundary-'));
  tempRoots.push(root);
  mkdirSync(join(root, 'chunks'), { recursive: true });
  writeFileSync(
    join(root, 'chunks', 'editor.js.map'),
    JSON.stringify({ version: 3, sources, names: [], mappings: '' }),
  );
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('screen SDK production module graph gate', () => {
  it('accepts a clean production sourcemap', () => {
    const root = makeSourcemapFixture([
      '../../packages/screen-editor-core/dist/index.js',
      '../../packages/shared/dist/index.js',
      '../../node_modules/.pnpm/react@19.1.0/node_modules/react/index.js',
      'assets/screen-sdk.css',
    ]);

    expect(checkDistBoundaries(root)).toEqual([]);
  });

  it.each([
    ['apps/web source', ['../../apps/web/src/features/screen/components/screen-canvas.tsx']],
    [
      'apps/web virtual bridge leftovers',
      ['../../apps/web/src/features/screen/sdk/screen-sdk-runtime.tsx'],
    ],
    ['dataset feature source', ['../../apps/web/src/features/dataset/hooks.ts']],
    ['api core client', ['../../apps/web/src/api/core/http-client.ts']],
    ['axios', ['../../node_modules/.pnpm/axios@1.7.9/node_modules/axios/index.js']],
    ['flat axios', ['../../node_modules/axios/index.js']],
    ['sonner', ['../../node_modules/.pnpm/sonner@2.0.3/node_modules/sonner/dist/index.js']],
    ['flat sonner', ['../../node_modules/sonner/dist/index.js']],
    [
      'tanstack react-query',
      [
        '../../node_modules/.pnpm/@tanstack+react-query@5.90.0/node_modules/@tanstack/react-query/index.js',
      ],
    ],
    [
      'tanstack react-router',
      [
        '../../node_modules/.pnpm/@tanstack+react-router@1.115.0/node_modules/@tanstack/react-router/index.js',
      ],
    ],
    ['flat tanstack react-query', ['../../node_modules/@tanstack/react-query/index.js']],
  ])('rejects %s in the production module graph', (_label, sources) => {
    const root = makeSourcemapFixture(sources);

    const findings = checkDistBoundaries(root);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain('forbidden production module');
  });

  it('normalizes Windows backslash source paths', () => {
    const root = makeSourcemapFixture([
      '..\\apps\\web\\src\\features\\screen\\hooks\\use-api-data-source.ts',
    ]);

    expect(checkDistBoundaries(root).join('\n')).toContain('forbidden production module');
  });

  it('reports every forbidden module in the same map', () => {
    const root = makeSourcemapFixture([
      '../../apps/web/src/features/screen/hooks/use-api-data-source.ts',
      '../../node_modules/.pnpm/axios@1.7.9/node_modules/axios/index.js',
      '../../node_modules/.pnpm/sonner@2.0.3/node_modules/sonner/dist/index.js',
    ]);

    expect(checkDistBoundaries(root)).toHaveLength(3);
  });

  it('allows source-free facade files without sourcemaps', () => {
    const root = makeSourcemapFixture(['../../src/index.ts']);
    writeFileSync(join(root, 'chunks', 'editor.js'), 'export {};\n');

    expect(checkDistBoundaries(root)).toEqual([]);
  });

  it('rejects executable JavaScript without a sourcemap', () => {
    const root = makeSourcemapFixture(['../../src/index.ts']);
    writeFileSync(join(root, 'chunks', 'runtime.js'), 'const value = 1; export { value };\n');

    expect(checkDistBoundaries(root).join('\n')).toContain('missing a sourcemap');
  });

  it('rejects sourcemaps with an empty sources array', () => {
    const root = makeSourcemapFixture([]);

    expect(checkDistBoundaries(root).join('\n')).toContain('sources must not be empty');
  });

  it('rejects sourcemaps without a valid string source', () => {
    const root = makeSourcemapFixture([]);
    writeFileSync(
      join(root, 'chunks', 'editor.js.map'),
      JSON.stringify({ version: 3, sources: [null], names: [], mappings: '' }),
    );

    expect(checkDistBoundaries(root).join('\n')).toContain('sources must not be empty');
  });

  it('rejects forbidden bare imports even without a sourcemap', () => {
    const root = makeSourcemapFixture(['../../src/index.ts']);
    writeFileSync(
      join(root, 'chunks', 'external.js'),
      "import axios from 'axios'; export { axios };\n",
    );

    expect(checkDistBoundaries(root).join('\n')).toContain('forbidden production import: axios');
  });

  it('rejects forbidden dynamic imports with import attributes', () => {
    const root = makeSourcemapFixture(['../../src/index.ts']);
    writeFileSync(
      join(root, 'chunks', 'external.js'),
      "void import('axios', { with: { type: 'json' } });\n",
    );

    expect(checkDistBoundaries(root).join('\n')).toContain('forbidden production import: axios');
  });
});
