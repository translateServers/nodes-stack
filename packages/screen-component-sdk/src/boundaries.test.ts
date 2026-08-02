/**
 * 依赖边界测试（Task 0.2）
 *
 * 确保 @nebula/screen-component-sdk 不依赖 React、ReactDOM、Router、Query、Axios
 * 或 private editor-core。
 * 第三方组件包只需依赖 @nebula/screen-component-sdk。
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = resolve(__dirname, '../package.json');

describe('screen-component-sdk dependency boundaries', () => {
  it('package.json 不应声明 React/ReactDOM/Router/Query/Axios/editor-core 依赖', () => {
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

  it('dependencies 应为空对象（零运行时依赖）', () => {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    expect(pkg.dependencies).toEqual({});
  });
});
