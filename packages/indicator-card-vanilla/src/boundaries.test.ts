/**
 * 依赖边界测试（Spec §13.2 Phase 2, Task 2.3）
 *
 * 确保 @nebula-example/indicator-card-vanilla 仅依赖 @nebula/screen-component-sdk，
 * 不依赖 React、ReactDOM、Router、Query、Axios 或 private editor-core/screen-sdk。
 *
 * Spec §1.1: 第三方组件包无框架依赖；宿主决定运行时框架。
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = resolve(__dirname, '../package.json');

describe('indicator-card-vanilla dependency boundaries', () => {
  it('package.json 不应声明 React/ReactDOM/Router/Query/Axios/editor-core/screen-sdk 依赖', () => {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const forbidden = [
      'react',
      'react-dom',
      '@tanstack/react-router',
      '@tanstack/react-query',
      'axios',
      '@nebula/screen-editor-core',
      '@nebula/screen-sdk',
    ];

    const allDeps = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };

    for (const dep of forbidden) {
      expect(allDeps[dep], `package.json 不应包含 ${dep}`).toBeUndefined();
    }
  });

  it('dependencies 只允许 @nebula/screen-component-sdk', () => {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    const depKeys = Object.keys(pkg.dependencies ?? {});
    expect(depKeys).toEqual(['@nebula/screen-component-sdk']);
  });
});
