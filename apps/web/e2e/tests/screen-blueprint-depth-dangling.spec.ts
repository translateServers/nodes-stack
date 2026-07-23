/**
 * 事件蓝图深度截断与 dangling E2E（任务 7.3）
 *
 * 覆盖：
 * - 深度截断：构造 11 个 action 的链（a11.depth=10），预览页点击触发器后
 *   - console.warn 收到深度截断告警
 *   - a11 被截断不执行（B 保持可见，证明截断生效）
 *   - 预览不死循环（页面仍响应）
 * - dangling：蓝图引用不存在的组件 ID
 *   - 预览页运行时跳过（点击不报错、页面仍响应）
 *   - 编辑器问题面板展示 warning 级 dangling 诊断
 *
 * 设计：
 * - 深度链：a1~a11 全部 setVisibility B，交替 hide/show
 *   a1:hide(0), a2:show(1), ..., a10:show(9), a11:hide(10 被截断)
 *   a1~a10 执行后 B=show(可见)，a11 被截断所以 B 保持可见
 * - dangling：通过 API 写入引用不存在组件的蓝图，编辑器加载后自动编译展示诊断
 */

import { expect, test } from '../fixtures/auth.fixture';
import {
  createRectComponent,
  createEllipseComponent,
  deleteScreenProject,
} from '../helpers/screen-api.helper';
import {
  buildDeepChainBlueprint,
  buildBlueprint,
  setupProjectWithBlueprint,
} from '../helpers/blueprint-action.helper';

test.describe('事件蓝图深度截断 E2E（任务 7.3）', () => {
  test('链式触发深度超过 10 → 截断告警 + 预览不死循环', async ({ browser }) => {
    const componentA = createRectComponent({
      name: '深度触发器',
      position: { x: 100, y: 100, width: 120, height: 80 },
    });
    const componentB = createEllipseComponent({
      name: '深度目标',
      position: { x: 300, y: 100, width: 120, height: 80 },
      status: { locked: false, hidden: false },
    });

    // 构造 11 个 action 的链：a1(hide) → a2(show) → ... → a10(show) → a11(hide 被截断)
    // a1~a10 执行后 B 最终 show(可见)；a11.depth=10 被截断不执行 hide → B 保持可见
    const actions = Array.from({ length: 11 }, (_, i) => ({
      id: `act-deep-${i + 1}`,
      config: {
        type: 'setVisibility' as const,
        targetComponentId: componentB.id,
        visible: i % 2 === 0 ? ('hide' as const) : ('show' as const),
      },
    }));

    const ts = Date.now();
    const { projectId } = await setupProjectWithBlueprint({
      name: `e2e-bp-depth-${ts}`,
      components: [componentA, componentB],
      blueprint: buildDeepChainBlueprint(
        'trig-depth',
        { type: 'componentClick', componentId: componentA.id },
        actions,
      ),
    });

    try {
      // 自行创建 context+page，便于在 goto 前注册 console 监听
      const context = await browser.newContext();
      const page = await context.newPage();

      // 收集 console.warn 消息（深度截断告警格式：[blueprint-runtime] 动作 xxx 深度 10 超过上限，已截断）
      const warnMessages: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'warning') {
          warnMessages.push(msg.text());
        }
      });

      try {
        const previewApiResponse = page.waitForResponse(
          (res) =>
            res.url().includes(`/screen/${projectId}/preview`) && res.request().method() === 'GET',
        );
        await page.goto(`/screen-preview/${projectId}`);
        const res = await previewApiResponse;
        expect(res.ok()).toBeTruthy();
        await page.waitForLoadState('networkidle');

        // 等待 B 初始渲染（visible）
        const componentBEl = page.locator(`[data-preview-component-id="${componentB.id}"]`);
        await expect(componentBEl).toBeVisible({ timeout: 5000 });

        // 点击触发器 A → 触发深度链执行
        const componentAEl = page.locator(`[data-preview-component-id="${componentA.id}"]`);
        await componentAEl.click();

        // 等待深度截断告警（a11.depth=10 被截断）
        // 告警消息格式：[blueprint-runtime] 动作 act-deep-11 深度 10 超过上限，已截断
        await expect
          .poll(() => warnMessages.some((m) => m.includes('act-deep-11') && m.includes('截断')))
          .toBeTruthy();

        // 断言 B 保持可见（a1~a10 执行后 B=show，a11 被截断没执行 hide）
        await expect(componentBEl).toBeVisible({ timeout: 3000 });

        // 断言预览不死循环：页面仍可响应（A 仍可见且可再次点击）
        await expect(componentAEl).toBeVisible();
      } finally {
        await context.close().catch(() => {});
      }
    } finally {
      await deleteScreenProject(projectId).catch(() => {});
    }
  });
});

test.describe('事件蓝图 dangling E2E（任务 7.3）', () => {
  test('预览页运行时跳过 dangling 动作 + 编辑器问题面板展示诊断', async ({
    browser,
    adminPage,
  }) => {
    const componentA = createRectComponent({
      name: 'dangling 触发器',
      position: { x: 100, y: 100, width: 120, height: 80 },
    });

    // 蓝图引用不存在的组件 ID（dangling）
    const DANGLING_TARGET_ID = 'non-existent-target-component';

    const ts = Date.now();
    const { projectId } = await setupProjectWithBlueprint({
      name: `e2e-bp-dangling-${ts}`,
      components: [componentA], // 项目只有 A，没有目标组件
      blueprint: buildBlueprint({
        triggerId: 'trig-dangling',
        triggerConfig: { type: 'componentClick', componentId: componentA.id },
        actionId: 'act-dangling',
        actionConfig: {
          type: 'setVisibility',
          targetComponentId: DANGLING_TARGET_ID,
          visible: 'hide',
        },
      }),
    });

    try {
      // ===== 1. 预览页运行时跳过验证 =====
      const context = await browser.newContext();
      const page = await context.newPage();

      // 收集 console.error（dangling 跳过不应产生未捕获异常）
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      try {
        const previewApiResponse = page.waitForResponse(
          (res) =>
            res.url().includes(`/screen/${projectId}/preview`) && res.request().method() === 'GET',
        );
        await page.goto(`/screen-preview/${projectId}`);
        const res = await previewApiResponse;
        expect(res.ok()).toBeTruthy();
        await page.waitForLoadState('networkidle');

        // 等待 A 初始渲染
        const componentAEl = page.locator(`[data-preview-component-id="${componentA.id}"]`);
        await expect(componentAEl).toBeVisible({ timeout: 5000 });

        // 点击触发器 A → 触发 dangling 动作（应被跳过，不报错）
        await componentAEl.click();

        // 等待短暂时间确保动作执行完毕（dangling 跳过是同步的）
        await page.waitForTimeout(500);

        // 断言无未捕获异常（预览不死循环、不崩溃）
        expect(pageErrors).toEqual([]);

        // 断言页面仍响应（A 仍可见）
        await expect(componentAEl).toBeVisible();
      } finally {
        await context.close().catch(() => {});
      }

      // ===== 2. 编辑器问题面板展示 dangling 诊断 =====
      // 导航到编辑器（草稿，未发布的项目也可打开编辑器）
      const editorLoaded = adminPage.waitForResponse(
        (res) =>
          res.url().includes(`/screen/${projectId}`) &&
          !res.url().includes(`${projectId}/`) &&
          res.request().method() === 'GET',
      );
      await adminPage.goto(`/screen/${projectId}`);
      await editorLoaded;
      await adminPage.waitForLoadState('networkidle');
      await expect(adminPage.getByTestId('canvas-surface')).toBeVisible();

      // 打开事件蓝图 Sheet
      await adminPage.getByRole('button', { name: '工具' }).click();
      await adminPage.getByRole('menuitem', { name: /^事件蓝图/ }).click();

      const sheet = adminPage.getByRole('dialog', { name: '事件蓝图' });
      await expect(sheet).toBeVisible({ timeout: 5000 });
      await expect(sheet.getByTestId('blueprint-canvas')).toBeVisible();

      // 等待问题面板渲染（编译器 rAF 节流后产出 dangling 诊断）
      const problemsPanel = sheet.getByTestId('blueprint-problems-panel');
      await expect(problemsPanel).toBeVisible({ timeout: 5000 });

      // 断言问题面板含 warning 级条目，message 含 dangling 关键词与目标组件 ID
      const warningItems = problemsPanel.locator(
        '[data-testid="problem-item"][data-severity="warning"]',
      );
      await expect(warningItems).toHaveCount(1, { timeout: 5000 });
      await expect(warningItems).toContainText(/dangling/i);
      await expect(warningItems).toContainText(DANGLING_TARGET_ID);

      // 关闭 Sheet
      await sheet.getByTestId('blueprint-sheet-close').click();
      await expect(sheet).not.toBeVisible({ timeout: 3000 });
    } finally {
      await deleteScreenProject(projectId).catch(() => {});
    }
  });
});
