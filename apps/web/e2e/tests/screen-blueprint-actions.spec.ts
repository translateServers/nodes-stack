/**
 * 事件蓝图动作 E2E（任务 7.2 - part 1）
 *
 * 覆盖三种动作的预览执行：
 * - navigate（_blank）：点击触发器后新窗口弹出，URL 命中 http/https 白名单
 * - scrollToComponent：点击触发器后调用目标元素的 scrollIntoView
 * - refreshDataSource：点击触发器后发起 API 请求并刷新柱状图数据
 *
 * 设计：
 * - 直接通过 API 写入完整蓝图（含参数 + 连线），跳过编辑器 UI
 * - 在匿名 context 中打开预览页，断言动作执行效果
 * - Mock 策略：refreshDataSource 通过 page.route 拦截 apiConfig.url，不依赖外网
 * - 数据隔离：每个用例独立创建并清理项目
 */

import { expect, test } from '../fixtures/auth.fixture';
import {
  createRectComponent,
  createBarChartComponent,
  deleteScreenProject,
} from '../helpers/screen-api.helper';
import {
  DEFAULT_MOCK_API_URL,
  mockApiSuccess,
  type ApiMockHandle,
} from '../helpers/api-mock.helper';
import {
  buildBlueprint,
  setupProjectWithBlueprint,
  openAnonymousPreview,
  injectScrollIntoViewSpy,
  getScrollIntoViewCalls,
} from '../helpers/blueprint-action.helper';

test.describe('事件蓝图动作 E2E - navigate（任务 7.2）', () => {
  test('点击触发器 → navigate _blank 打开白名单 URL', async ({ browser }) => {
    // 准备：A 是触发器组件，蓝图配置 navigate 到 https://example.com/
    const componentA = createRectComponent({
      name: '触发-navigate',
      position: { x: 100, y: 100, width: 120, height: 80 },
    });
    const ts = Date.now();
    const { projectId } = await setupProjectWithBlueprint({
      name: `e2e-bp-navigate-${ts}`,
      components: [componentA],
      blueprint: buildBlueprint({
        triggerId: 'trig-nav',
        triggerConfig: { type: 'componentClick', componentId: componentA.id },
        actionId: 'act-nav',
        actionConfig: { type: 'navigate', url: 'https://example.com/', target: '_blank' },
      }),
    });

    try {
      const { page, dispose } = await openAnonymousPreview(browser, projectId);
      try {
        // 点击触发器前先监听 popup 事件（window.open 触发新 page 事件）
        const popupPromise = page.context().waitForEvent('page', { timeout: 5000 });
        await page.locator(`[data-preview-component-id="${componentA.id}"]`).click();
        const popup = await popupPromise;
        // 等待 popup 完成导航（初始可能为 about:blank）
        await popup.waitForLoadState('domcontentloaded', { timeout: 10_000 });
        expect(popup.url()).toBe('https://example.com/');
      } finally {
        await dispose();
      }
    } finally {
      await deleteScreenProject(projectId).catch(() => {});
    }
  });
});

test.describe('事件蓝图动作 E2E - scrollToComponent（任务 7.2）', () => {
  test('点击触发器 → 调用目标组件 scrollIntoView', async ({ browser }) => {
    const componentA = createRectComponent({
      name: '触发-scroll',
      position: { x: 100, y: 100, width: 120, height: 80 },
    });
    const componentB = createRectComponent({
      name: '目标-scroll',
      position: { x: 400, y: 100, width: 120, height: 80 },
      style: {
        backgroundColor: '#ef4444',
        borderWidth: 0,
        borderColor: '#991b1b',
        borderRadius: 0,
      },
    });
    const ts = Date.now();
    const { projectId } = await setupProjectWithBlueprint({
      name: `e2e-bp-scroll-${ts}`,
      components: [componentA, componentB],
      blueprint: buildBlueprint({
        triggerId: 'trig-scroll',
        triggerConfig: { type: 'componentClick', componentId: componentA.id },
        actionId: 'act-scroll',
        actionConfig: { type: 'scrollToComponent', targetComponentId: componentB.id },
      }),
    });

    try {
      // 在新建 context 的 page 上注入 spy（必须在 goto 前调用 addInitScript）
      const context = await browser.newContext();
      const page = await context.newPage();
      await injectScrollIntoViewSpy(page);
      try {
        await page.goto(`/screen-preview/${projectId}`);
        await page.waitForLoadState('networkidle');

        // 等待 B 渲染完成
        const componentBEl = page.locator(`[data-preview-component-id="${componentB.id}"]`);
        await expect(componentBEl).toBeVisible({ timeout: 5000 });

        // 点击前：spy 调用记录为空
        const callsBefore = await getScrollIntoViewCalls(page);
        expect(callsBefore).toEqual([]);

        // 点击 A
        await page.locator(`[data-preview-component-id="${componentA.id}"]`).click();

        // 等待并断言 spy 记录到 B 的调用
        await expect
          .poll(async () => await getScrollIntoViewCalls(page), {
            timeout: 5000,
          })
          .toEqual([componentB.id]);
      } finally {
        await context.close().catch(() => {});
      }
    } finally {
      await deleteScreenProject(projectId).catch(() => {});
    }
  });
});

test.describe('事件蓝图动作 E2E - refreshDataSource（任务 7.2）', () => {
  test('点击触发器 → API 重新请求并刷新柱状图数据', async ({ browser }) => {
    // 柱状图配置 API 数据源，url 指向 mock
    const barChart = createBarChartComponent({
      name: '柱状图-refresh',
      dataSource: {
        type: 'api',
        apiConfig: { url: DEFAULT_MOCK_API_URL, method: 'GET' },
      },
    });
    const componentA = createRectComponent({
      name: '触发-refresh',
      // 位置避开 barChart（默认 100,100 大小 400x300，覆盖 100-500/100-400）
      position: { x: 100, y: 500, width: 120, height: 80 },
    });
    const ts = Date.now();
    const { projectId } = await setupProjectWithBlueprint({
      name: `e2e-bp-refresh-${ts}`,
      components: [componentA, barChart],
      blueprint: buildBlueprint({
        triggerId: 'trig-refresh',
        triggerConfig: { type: 'componentClick', componentId: componentA.id },
        actionId: 'act-refresh',
        actionConfig: { type: 'refreshDataSource', targetComponentId: barChart.id },
      }),
    });

    let mock: ApiMockHandle | undefined;
    const context = await browser.newContext();
    try {
      const page = await context.newPage();

      // 第一阶段：mock 必须在 goto 之前注册（useApiDataSource 在 mount 时即发起请求）
      const initialData = [
        { name: '一月', value: 120 },
        { name: '二月', value: 200 },
      ];
      mock = await mockApiSuccess(page, { body: initialData });

      // 监听预览 API 响应，等待加载完成
      const previewApiResponse = page.waitForResponse(
        (res) =>
          res.url().includes(`/screen/${projectId}/preview`) && res.request().method() === 'GET',
      );
      await page.goto(`/screen-preview/${projectId}`);
      const res = await previewApiResponse;
      expect(res.ok()).toBeTruthy();
      await page.waitForLoadState('networkidle');

      // 等待柱状图渲染初始数据（断言 2 根柱条，且文本包含 "一月"）
      const chartSvg = page.locator('svg[viewBox="0 0 400 300"]');
      await expect(chartSvg).toBeVisible({ timeout: 5000 });
      await expect(chartSvg.locator('text', { hasText: '一月' })).toBeVisible({ timeout: 5000 });
      const initialCount = mock.requestCount();
      expect(initialCount).toBeGreaterThanOrEqual(1);

      // 第二阶段：dispose 旧 mock，新 mock 返回刷新后的数据（四月/五月/六月）
      await mock.dispose();
      const refreshedData = [
        { name: '四月', value: 350 },
        { name: '五月', value: 280 },
        { name: '六月', value: 410 },
      ];
      mock = await mockApiSuccess(page, { body: refreshedData });
      // 新 mock 的计数从 0 重新开始；记录基数后再断言增量
      const refreshMockBaseline = mock.requestCount();

      // 点击触发器 → 触发 refreshDataSource
      await page.locator(`[data-preview-component-id="${componentA.id}"]`).click();

      // 断言：新 mock 请求计数 +1（refreshDataSource 触发了新请求）
      await expect
        .poll(() => mock?.requestCount() ?? 0, { timeout: 5000 })
        .toBe(refreshMockBaseline + 1);

      // 断言：柱状图刷新为新数据（柱条数从 2 变为 3，文本包含 "四月"）
      await expect
        .poll(async () => await chartSvg.locator('rect').count(), {
          timeout: 5000,
        })
        .toBe(3);
      await expect(chartSvg.locator('text', { hasText: '四月' })).toBeVisible();
      // 旧数据应消失（断言"一月"文本不再渲染于图表内）
      await expect(chartSvg.locator('text', { hasText: '一月' })).toHaveCount(0);
    } finally {
      await mock?.dispose().catch(() => {});
      await context.close().catch(() => {});
      await deleteScreenProject(projectId).catch(() => {});
    }
  });
});
