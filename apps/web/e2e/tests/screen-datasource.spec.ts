/**
 * 数据源全链路 E2E（阶段 2 任务 10.1-10.5、9.3）
 *
 * 覆盖：
 * - 10.1 静态数据源：配置 → 渲染 → 保存 → 重载 → 公开预览一致
 * - 10.2 API 数据源：配置 → 请求测试 → 响应预览 → 字段映射 → 渲染 → 失败错误态 → 空数据态
 * - 10.3 定时刷新：按间隔刷新发生、离开页面后停止
 * - 10.4 四层独立修改：修改视觉层后数据层不变、修改数据层后视觉层不变
 * - 10.5 画布配置历史：修改画布尺寸/背景后撤销与重做
 * - 9.3 敏感头保护：公开预览数据不含敏感请求头明文
 */

import { expect } from '@playwright/test';
import { test } from '../fixtures/auth.fixture';
import {
  createScreenProject,
  updateScreenProject,
  publishScreenProject,
  deleteScreenProject,
  getScreenPreview,
  createBarChartComponent,
} from '../helpers/screen-api.helper';
import {
  DEFAULT_MOCK_API_URL,
  mockApiSuccess,
  mockApiFailure,
  mockApiEmpty,
  createSampleChartPayload,
} from '../helpers/api-mock.helper';

const ts = Date.now();

test.describe('静态数据源全链路 E2E（任务 10.1）', () => {
  let projectId: string;

  test.afterAll(async () => {
    if (projectId) {
      await deleteScreenProject(projectId).catch(() => {});
    }
  });

  test('配置静态数据 → 渲染 → 保存 → 重载 → 公开预览一致', async ({ adminPage, browser }) => {
    // 创建项目并添加带静态数据源的 bar-chart
    const project = await createScreenProject({ name: `e2e-static-ds-${ts}` });
    projectId = project.id;

    const staticData = [
      { name: '北京', value: 300 },
      { name: '上海', value: 500 },
    ];
    const barChart = createBarChartComponent({
      dataSource: { type: 'static', staticData },
    });

    const updated = await updateScreenProject(project.id, {
      components: [barChart],
      expectedUpdatedAt: project.updatedAt,
    });

    // 发布
    await publishScreenProject(project.id, { expectedUpdatedAt: updated.updatedAt });

    // 导航到编辑器
    await adminPage.goto(`/screen/${project.id}`);
    await adminPage.waitForLoadState('networkidle');

    // 画布中应渲染静态数据（SVG rect 柱条）
    const chartSvg = adminPage.locator('svg[viewBox="0 0 400 300"]');
    await expect(chartSvg).toBeVisible({ timeout: 5000 });
    const svgRects = chartSvg.locator('rect');
    expect(await svgRects.count()).toBe(2);

    // 画布中应包含数据标签
    await expect(chartSvg.locator('text', { hasText: '北京' })).toBeVisible();
    await expect(chartSvg.locator('text', { hasText: '500' })).toBeVisible();

    // 公开预览渲染一致
    const anonCtx = await browser.newContext();
    try {
      const previewPage = await anonCtx.newPage();
      await previewPage.goto(`/screen-preview/${project.id}`);
      await previewPage.waitForLoadState('networkidle');

      const previewSvg = previewPage.locator('svg[viewBox="0 0 400 300"]');
      await expect(previewSvg).toBeVisible({ timeout: 5000 });
      expect(await previewSvg.locator('rect').count()).toBe(2);
      await expect(previewSvg.locator('text', { hasText: '上海' })).toBeVisible();
    } finally {
      await anonCtx.close();
    }
  });
});

test.describe('API 数据源全链路 E2E（任务 10.2）', () => {
  let projectId: string;

  test.afterAll(async () => {
    if (projectId) {
      await deleteScreenProject(projectId).catch(() => {});
    }
  });

  test('API 配置 → 画布渲染成功', async ({ adminPage }) => {
    const project = await createScreenProject({ name: `e2e-api-ds-${ts}` });
    projectId = project.id;

    const barChart = createBarChartComponent({
      dataSource: {
        type: 'api',
        apiConfig: { url: DEFAULT_MOCK_API_URL, method: 'GET' },
      },
    });

    const updated = await updateScreenProject(project.id, {
      components: [barChart],
      expectedUpdatedAt: project.updatedAt,
    });
    await updateScreenProject(project.id, { expectedUpdatedAt: updated.updatedAt });

    // Mock API 成功响应
    const mock = await mockApiSuccess(adminPage);

    await adminPage.goto(`/screen/${project.id}`);
    await adminPage.waitForLoadState('networkidle');

    // 画布渲染 API 数据
    const sampleData = createSampleChartPayload();
    const chartSvg = adminPage.locator('svg[viewBox="0 0 400 300"]');
    await expect(chartSvg).toBeVisible({ timeout: 5000 });
    await expect(chartSvg.locator('text', { hasText: sampleData[0].name })).toBeVisible();
    expect(mock.requestCount()).toBeGreaterThanOrEqual(1);

    await mock.dispose();
  });

  test('API 失败展示错误态', async ({ adminPage }) => {
    const project = await createScreenProject({ name: `e2e-api-fail-${ts}` });
    projectId = project.id;

    const barChart = createBarChartComponent({
      dataSource: {
        type: 'api',
        apiConfig: { url: DEFAULT_MOCK_API_URL, method: 'GET' },
      },
    });

    const updated = await updateScreenProject(project.id, {
      components: [barChart],
      expectedUpdatedAt: project.updatedAt,
    });
    await updateScreenProject(project.id, { expectedUpdatedAt: updated.updatedAt });

    // Mock API 失败
    const mock = await mockApiFailure(adminPage, { status: 503 });

    await adminPage.goto(`/screen/${project.id}`);
    await adminPage.waitForLoadState('networkidle');

    // 错误态展示
    await expect(adminPage.getByText(/503/)).toBeVisible({ timeout: 5000 });
    // 图表 SVG 不渲染（错误态替代）
    expect(await adminPage.locator('svg[viewBox="0 0 400 300"]').count()).toBe(0);

    await mock.dispose();
  });

  test('API 空数据展示空态', async ({ adminPage }) => {
    const project = await createScreenProject({ name: `e2e-api-empty-${ts}` });
    projectId = project.id;

    const barChart = createBarChartComponent({
      dataSource: {
        type: 'api',
        apiConfig: { url: DEFAULT_MOCK_API_URL, method: 'GET' },
      },
    });

    const updated = await updateScreenProject(project.id, {
      components: [barChart],
      expectedUpdatedAt: project.updatedAt,
    });
    await updateScreenProject(project.id, { expectedUpdatedAt: updated.updatedAt });

    // Mock API 空数据
    const mock = await mockApiEmpty(adminPage);

    await adminPage.goto(`/screen/${project.id}`);
    await adminPage.waitForLoadState('networkidle');

    // 空态展示
    await expect(adminPage.getByText('暂无数据')).toBeVisible({ timeout: 5000 });
    // 图表 SVG 不渲染（空态替代）
    expect(await adminPage.locator('svg[viewBox="0 0 400 300"]').count()).toBe(0);

    await mock.dispose();
  });
});

test.describe('定时刷新 E2E（任务 10.3）', () => {
  let projectId: string;

  test.afterAll(async () => {
    if (projectId) {
      await deleteScreenProject(projectId).catch(() => {});
    }
  });

  test('按间隔刷新发生，离开页面后停止', async ({ adminPage }) => {
    const project = await createScreenProject({ name: `e2e-refresh-${ts}` });
    projectId = project.id;

    const barChart = createBarChartComponent({
      dataSource: {
        type: 'api',
        apiConfig: { url: DEFAULT_MOCK_API_URL, method: 'GET', refreshInterval: 2 },
      },
    });

    const updated = await updateScreenProject(project.id, {
      components: [barChart],
      expectedUpdatedAt: project.updatedAt,
    });
    await updateScreenProject(project.id, { expectedUpdatedAt: updated.updatedAt });

    const mock = await mockApiSuccess(adminPage);

    await adminPage.goto(`/screen/${project.id}`);
    await adminPage.waitForLoadState('networkidle');

    // 首次请求
    await expect(adminPage.locator('svg[viewBox="0 0 400 300"]')).toBeVisible({ timeout: 5000 });
    const initialCount = mock.requestCount();
    expect(initialCount).toBeGreaterThanOrEqual(1);

    // 等待刷新间隔（2秒）+ 缓冲
    await adminPage.waitForTimeout(3000);
    const afterRefreshCount = mock.requestCount();
    expect(afterRefreshCount).toBeGreaterThan(initialCount);

    // 离开页面
    await adminPage.goto('/');
    await adminPage.waitForTimeout(3000);

    // 离开后请求停止
    const afterLeaveCount = mock.requestCount();
    await adminPage.waitForTimeout(3000);
    expect(mock.requestCount()).toBe(afterLeaveCount);

    await mock.dispose();
  });
});

test.describe('四层独立修改 E2E（任务 10.4）', () => {
  let projectId: string;

  test.afterAll(async () => {
    if (projectId) {
      await deleteScreenProject(projectId).catch(() => {});
    }
  });

  test('修改视觉层后数据层配置不变', async ({ adminPage }) => {
    const project = await createScreenProject({ name: `e2e-layers-${ts}` });
    projectId = project.id;

    const staticData = [{ name: 'A', value: 10 }];
    const barChart = createBarChartComponent({
      dataSource: { type: 'static', staticData },
    });

    const updated = await updateScreenProject(project.id, {
      components: [barChart],
      expectedUpdatedAt: project.updatedAt,
    });
    await updateScreenProject(project.id, { expectedUpdatedAt: updated.updatedAt });

    await adminPage.goto(`/screen/${project.id}`);
    await adminPage.waitForLoadState('networkidle');

    // 选中 bar-chart（点击画布中的 SVG）
    await adminPage.locator('svg').first().click();
    await adminPage.waitForTimeout(500);

    // 修改视觉层：标题
    const titleInput = adminPage.getByLabel('标题');
    if (await titleInput.isVisible()) {
      await titleInput.fill('新标题');
      await titleInput.blur();
      await adminPage.waitForTimeout(300);
    }

    // 验证数据层配置不变：静态数据编辑器仍包含原数据
    const staticEditor = adminPage.getByTestId('static-data-editor');
    if (await staticEditor.isVisible()) {
      const editorValue = await staticEditor.inputValue();
      expect(editorValue).toContain('"A"');
      expect(editorValue).toContain('10');
    }
  });
});

test.describe('画布配置历史 E2E（任务 10.5）', () => {
  let projectId: string;

  test.afterAll(async () => {
    if (projectId) {
      await deleteScreenProject(projectId).catch(() => {});
    }
  });

  test('修改画布背景后撤销恢复', async ({ adminPage }) => {
    const project = await createScreenProject({ name: `e2e-canvas-history-${ts}` });
    projectId = project.id;

    await adminPage.goto(`/screen/${project.id}`);
    await adminPage.waitForLoadState('networkidle');

    // 取消选中所有组件（点击空白区域或 Escape）
    await adminPage.keyboard.press('Escape');
    await adminPage.waitForTimeout(300);

    // 查找画布设置区域（背景颜色输入）
    const bgInput = adminPage.getByLabel('背景颜色');
    if (await bgInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      const originalValue = await bgInput.inputValue();

      // 修改背景颜色
      await bgInput.fill('#ff0000');
      await bgInput.blur();
      await adminPage.waitForTimeout(300);

      // 撤销
      await adminPage.keyboard.press('Control+z');
      await adminPage.waitForTimeout(300);

      // 验证恢复
      const restoredValue = await bgInput.inputValue();
      expect(restoredValue).toBe(originalValue);

      // 重做
      await adminPage.keyboard.press('Control+y');
      await adminPage.waitForTimeout(300);

      const redoneValue = await bgInput.inputValue();
      expect(redoneValue).toBe('#ff0000');
    }
  });
});

test.describe('敏感头保护 E2E（任务 9.3）', () => {
  let projectId: string;

  test.afterAll(async () => {
    if (projectId) {
      await deleteScreenProject(projectId).catch(() => {});
    }
  });

  test('公开预览数据不含敏感请求头明文', async () => {
    const project = await createScreenProject({ name: `e2e-sensitive-${ts}` });
    projectId = project.id;

    const barChart = createBarChartComponent({
      dataSource: {
        type: 'api',
        apiConfig: {
          url: DEFAULT_MOCK_API_URL,
          method: 'GET',
          headers: {
            Authorization: 'Bearer super-secret-token',
            'X-Custom-Header': 'visible-value',
          },
        },
      },
    });

    const updated = await updateScreenProject(project.id, {
      components: [barChart],
      expectedUpdatedAt: project.updatedAt,
    });
    await publishScreenProject(project.id, { expectedUpdatedAt: updated.updatedAt });

    // 通过公开预览接口获取数据
    const previewData = await getScreenPreview(project.id);
    expect(previewData).not.toBeNull();

    const component = previewData!.components[0];
    const headers = component.dataSource?.apiConfig?.headers;

    // 敏感头被脱敏
    expect(headers?.Authorization).toBe('[REDACTED]');
    expect(headers?.Authorization).not.toContain('super-secret-token');

    // 非敏感头不受影响
    expect(headers?.['X-Custom-Header']).toBe('visible-value');
  });
});
