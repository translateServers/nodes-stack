/**
 * Vue 3 Consumer 动态 SDK smoke（A1-GATE）。
 *
 * - designer 元素挂载并渲染契约组件
 * - viewer 元素挂载 + fake adapter 数据执行闭环（指标值渲染）
 * - 保存方法返回文档
 */

import { expect, test } from '@playwright/test';

test.describe('screen-dynamic-sdk Vue 3 consumer', () => {
  test('designer 挂载并渲染契约组件', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('tab-designer').click();
    const designer = page.getByTestId('designer');
    await expect(designer).toBeVisible();

    // designer shadowRoot 内应出现契约组件
    await expect
      .poll(async () => {
        const count = await designer.evaluate((element) => {
          const shadow = (element as HTMLElement).shadowRoot;
          return shadow?.querySelectorAll('xj-metric-card-v1, xj-chart-bar-v1').length ?? 0;
        });
        return count;
      })
      .toBeGreaterThanOrEqual(2);

    await expect(page.getByTestId('event-log')).toHaveText('designer ready');
  });

  test('保存方法返回文档', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('tab-designer').click();
    await page.waitForTimeout(300);
    await page.getByTestId('btn-save').click();
    await expect(page.getByTestId('event-log')).toContainText('saved 3 components');
  });

  test('viewer 挂载并执行 fake 数据（指标值渲染）', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('tab-viewer').click();
    const viewer = page.getByTestId('viewer');
    await expect(viewer).toBeVisible();

    // 等数据执行完成：指标卡渲染最后一行值（database_online=4）
    await expect
      .poll(async () => {
        const value = await viewer.evaluate((element) => {
          const shadow = (element as HTMLElement).shadowRoot;
          return (
            shadow?.querySelector('xj-metric-card-v1')?.shadowRoot?.querySelector('.value')
              ?.textContent ?? ''
          );
        });
        return value;
      })
      .toBe('4');

    // 柱状图渲染 3 根柱子（fake 数据 3 行）
    const barCount = await viewer.evaluate((element) => {
      const shadow = (element as HTMLElement).shadowRoot;
      return (
        shadow?.querySelector('xj-chart-bar-v1')?.shadowRoot?.querySelectorAll('.bar').length ?? 0
      );
    });
    expect(barCount).toBe(3);
  });
});
