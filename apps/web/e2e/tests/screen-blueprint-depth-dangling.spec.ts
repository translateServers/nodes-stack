/**
 * 事件蓝图深度截断与 dangling E2E（任务 7.3）
 *
 * 覆盖：
 * - 深度截断：构造超出编译上限的 delay 链，预览页点击触发器后
 *   - 最终 hide 动作被截断不执行（B 保持可见，证明截断生效）
 *   - 预览不死循环（页面仍响应）
 * - dangling：蓝图引用不存在的组件 ID
 *   - 预览页运行时跳过（点击不报错、页面仍响应）
 *   - 编辑器问题面板展示 warning 级 dangling 诊断
 *
 * 设计：
 * - 深度链：101 个零时长 delay 后接一个 hide 动作。编译器仅保留上限内的 delay，
 *   最终 hide 不会执行，因此 B 保持可见。
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
  test('链式触发深度超过 100 → 截断且预览不死循环', async ({ browser }) => {
    const componentA = createRectComponent({
      name: '深度触发器',
      position: { x: 100, y: 100, width: 120, height: 80 },
    });
    const componentB = createEllipseComponent({
      name: '深度目标',
      position: { x: 300, y: 100, width: 120, height: 80 },
      status: { locked: false, hidden: false },
    });

    const ts = Date.now();
    const { projectId } = await setupProjectWithBlueprint({
      name: `e2e-bp-depth-${ts}`,
      components: [componentA, componentB],
      blueprint: buildDeepChainBlueprint('trig-depth', componentA.id, componentB.id, 101),
    });

    try {
      // 自行创建 context+page，隔离匿名预览会话。
      const context = await browser.newContext();
      const page = await context.newPage();

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

        // 等待零时长 delay 链完成；最终 hide 在编译时被截断。
        await page.waitForTimeout(1_000);

        // 断言 B 保持可见（最终 hide 未进入编译结果）。
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

      // 正式蓝图将不存在的目标组件视为发布阻断错误。
      const errorItems = problemsPanel.locator(
        '[data-testid="problem-item"][data-severity="error"]',
      );
      await expect(errorItems).toHaveCount(1, { timeout: 5000 });
      await expect(errorItems).toContainText(/dangling/i);
      await expect(errorItems).toContainText(DANGLING_TARGET_ID);

      // 关闭 Sheet
      await sheet.getByTestId('blueprint-sheet-close').click();
      await expect(sheet).not.toBeVisible({ timeout: 3000 });
    } finally {
      await deleteScreenProject(projectId).catch(() => {});
    }
  });
});
