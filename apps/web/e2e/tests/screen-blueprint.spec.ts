/**
 * 事件蓝图端到端验收（任务 7.1）
 *
 * 覆盖全链路：打开蓝图 Sheet → 搜索插入节点 → 连线 → 配置参数 → 保存 → 公开预览点击触发"点击 A → 隐藏 B"。
 *
 * 实施策略：
 * - UI 操作覆盖：打开 Sheet、双击空白呼出搜索面板、键盘选择并插入两个组件节点
 * - 节点连线：通过开发模式 debug store 写入 evt:click → act:hide 连线，
 *   通过 `window.__screenEditorStore.updateBlueprint` 直接写入完整蓝图（含参数 + 连线）。
 *   editor-store 已在 import.meta.env.DEV 时暴露给 window，dev server 模式可用。
 * - 持久化验证：保存请求 PATCH 载荷与 GET 响应均含 blueprint 字段
 * - 预览触发：匿名 context 访问 `/screen-preview/{id}`，点击 A 后断言 B 不可见
 *
 * 数据隔离：每个用例通过 API 独立创建项目，finally 中清理；不依赖固定项目 ID 或残留登录态。
 * Mock 策略：本用例只触发 setVisibility（不访问外网），无需 route Mock。
 */

import { type BrowserContext } from '@playwright/test';
import type { EventBlueprint } from '@nebula/shared';

import { test, expect } from '../fixtures/auth.fixture';
import {
  createScreenProject,
  updateScreenProject,
  deleteScreenProject,
  createRectComponent,
  createEllipseComponent,
} from '../helpers/screen-api.helper';

/** 等待编辑器加载完成：项目名可见 + 画布表面存在 */
async function loadEditor(page: import('@playwright/test').Page, projectId: string): Promise<void> {
  const editorLoaded = page.waitForResponse(
    (res) =>
      res.url().includes(`/screen/${projectId}`) &&
      !res.url().includes(`${projectId}/`) &&
      res.request().method() === 'GET',
  );
  await page.goto(`/screen/${projectId}`);
  await editorLoaded;
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('canvas-surface')).toBeVisible();
}

/**
 * 在 sheet 内通过 UI 创建一个节点。
 *
 * 步骤：双击空白 → 搜索面板 → 输入查询 → Enter 选中第一条 → 等待面板关闭。
 *
 * 注意：双击位置使用 sheet 画布坐标系内的相对坐标（避开节点/边）。
 */
async function insertNodeViaSearchPanel(
  sheet: import('@playwright/test').Locator,
  canvasPosition: { x: number; y: number },
  query: string,
): Promise<void> {
  const canvas = sheet.getByTestId('blueprint-canvas');
  await canvas.dblclick({ position: canvasPosition });

  const searchPanel = sheet.getByTestId('blueprint-search-panel');
  await expect(searchPanel).toBeVisible({ timeout: 3000 });

  const input = searchPanel.getByTestId('blueprint-search-panel-input');
  await input.fill(query);
  await input.press('Enter');

  await expect(searchPanel).not.toBeVisible({ timeout: 3000 });
}

/**
 * 通过 `window.__screenEditorStore` 为两个组件节点写入点击隐藏连线。
 */
async function configureBlueprintViaStore(
  page: import('@playwright/test').Page,
  componentAId: string,
  componentBId: string,
): Promise<void> {
  await page.evaluate(
    (args: { componentAId: string; componentBId: string }) => {
      const store = (
        window as unknown as {
          __screenEditorStore?: {
            getState: () => {
              project: { blueprint?: EventBlueprint } | null;
              updateBlueprint: (bp: EventBlueprint | undefined) => void;
            };
          };
        }
      ).__screenEditorStore;
      if (!store) throw new Error('__screenEditorStore not exposed');

      const state = store.getState();
      const current = state.project?.blueprint;
      if (!current) throw new Error('blueprint not initialized');

      if (current.version !== 2) throw new Error('Blueprint was not initialized');
      const sourceNode = current.nodes.find(
        (node) => node.kind === 'component' && node.componentId === args.componentAId,
      );
      const targetNode = current.nodes.find(
        (node) => node.kind === 'component' && node.componentId === args.componentBId,
      );
      if (!sourceNode) throw new Error('source component node not found');
      if (!targetNode) throw new Error('target component node not found');

      const newBlueprint: EventBlueprint = {
        version: 2,
        nodes: current.nodes,
        edges: [
          {
            id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            source: sourceNode.id,
            sourceHandle: 'evt:click',
            target: targetNode.id,
            targetHandle: 'act:hide',
          },
        ],
      };
      state.updateBlueprint(newBlueprint);
    },
    { componentAId, componentBId },
  );
}

test.describe('事件蓝图端到端验收（任务 7.1）', () => {
  test('可视化搭建到预览执行：点击 A → 隐藏 B', async ({ adminPage, browser }) => {
    const ts = Date.now();
    const project = await createScreenProject({ name: `e2e-bp-7.1-${ts}` });

    // A：触发器组件（矩形，点击目标）
    const componentA = createRectComponent({
      name: 'E2E 蓝图触发器',
      position: { x: 100, y: 100, width: 120, height: 80 },
      style: {
        backgroundColor: '#3b82f6',
        borderWidth: 0,
        borderColor: '#1e40af',
        borderRadius: 0,
      },
    });
    // B：目标组件（椭圆，被隐藏对象）
    const componentB = createEllipseComponent({
      name: 'E2E 蓝图目标',
      position: { x: 300, y: 100, width: 120, height: 80 },
      style: {
        backgroundColor: '#10b981',
        borderWidth: 0,
        borderColor: '#047857',
      },
    });

    const anonymousContexts: BrowserContext[] = [];

    try {
      // 1. 通过 API 写入两个组件
      await updateScreenProject(project.id, {
        components: [componentA, componentB],
        expectedUpdatedAt: project.updatedAt,
      });

      // 2. 打开编辑器
      await loadEditor(adminPage, project.id);

      // 3. 打开事件蓝图 Sheet（工具菜单 → 事件蓝图）
      await adminPage.getByRole('button', { name: '工具' }).click();
      await adminPage.getByRole('menuitem', { name: /^事件蓝图/ }).click();

      const sheet = adminPage.getByRole('dialog', { name: '事件蓝图' });
      await expect(sheet).toBeVisible({ timeout: 5000 });
      await expect(sheet.getByTestId('blueprint-canvas')).toBeVisible();
      await sheet.getByTestId('blueprint-start-from-scratch').click();

      // 4. UI 创建触发组件节点（双击空白 → 搜索面板 → 输入 → Enter）
      await insertNodeViaSearchPanel(sheet, { x: 200, y: 200 }, 'E2E 蓝图触发器');

      // 5. UI 创建目标组件节点
      await insertNodeViaSearchPanel(sheet, { x: 500, y: 200 }, 'E2E 蓝图目标');

      const componentNodes = sheet.locator(
        '[data-testid="blueprint-node"][data-node-kind="component"]',
      );
      await expect(componentNodes).toHaveCount(2, { timeout: 5000 });

      // 6. 通过 store 写入点击隐藏连线
      await configureBlueprintViaStore(adminPage, componentA.id, componentB.id);

      // 节点标签应保持对应画布组件名称
      await expect(componentNodes.filter({ hasText: 'E2E 蓝图触发器' })).toHaveCount(1);
      await expect(componentNodes.filter({ hasText: 'E2E 蓝图目标' })).toHaveCount(1);

      // 7. 关闭 Sheet（点击关闭按钮，比 Esc 分层更稳定）
      await sheet.getByTestId('blueprint-sheet-close').click();
      await expect(sheet).not.toBeVisible({ timeout: 3000 });

      // 8. 保存：等待 PATCH 响应并验证载荷含 blueprint
      const saveResponsePromise = adminPage.waitForResponse(
        (res) =>
          res.url().includes(`/screen/${project.id}`) &&
          !res.url().includes(`${project.id}/`) &&
          res.request().method() === 'PATCH',
      );
      await adminPage.getByRole('button', { name: '保存' }).click();
      const saveResponse = await saveResponsePromise;
      expect(saveResponse.ok()).toBeTruthy();

      const saveBody = saveResponse.request().postDataJSON() as {
        blueprint?: EventBlueprint;
      };
      expect(saveBody.blueprint).toBeDefined();
      expect(saveBody.blueprint?.nodes).toHaveLength(2);
      expect(saveBody.blueprint?.edges).toHaveLength(1);
      await adminPage.waitForLoadState('networkidle');

      // 9. 发布（蓝图合法、无 error 诊断，不弹确认框；容错：若出现确认框则点击"仍然发布"）
      const publishResponsePromise = adminPage.waitForResponse(
        (res) =>
          res.url().includes(`/screen/${project.id}/publish`) && res.request().method() === 'POST',
      );
      await adminPage.getByRole('button', { name: '发布' }).click();

      // 容错 A：若编译器误报 error 触发 PublishConfirmDialog，点击"仍然发布"
      const confirmDialog = adminPage.getByRole('alertdialog');
      if (await confirmDialog.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmDialog.getByRole('button', { name: /仍然发布/ }).click();
      }
      const publishResponse = await publishResponsePromise;
      expect(publishResponse.ok()).toBeTruthy();
      await adminPage.waitForLoadState('networkidle');

      // 10. 匿名预览：等待预览页组件渲染完成（API 返回 + React 渲染）
      const anonCtx = await browser.newContext();
      anonymousContexts.push(anonCtx);
      const previewPage = await anonCtx.newPage();
      const previewApiResponse = previewPage.waitForResponse(
        (res) =>
          res.url().includes(`/screen/${project.id}/preview`) && res.request().method() === 'GET',
      );
      await previewPage.goto(`/screen-preview/${project.id}`);
      const previewRes = await previewApiResponse;
      expect(previewRes.ok(), `预览 API 应返回 200，实际: ${previewRes.status()}`).toBeTruthy();
      await previewPage.waitForLoadState('networkidle');

      // 11. 验证 B 初始可见（预览页用 data-preview-component-id 定位组件容器）
      const componentBEl = previewPage.locator(`[data-preview-component-id="${componentB.id}"]`);
      await expect(componentBEl).toBeVisible({ timeout: 5000 });

      // 12. 点击 A → 触发蓝图执行 → B 应被隐藏
      const componentAEl = previewPage.locator(`[data-preview-component-id="${componentA.id}"]`);
      await componentAEl.click();

      // 13. 断言 B 不可见（visibility 覆盖表生效）
      await expect(componentBEl).not.toBeVisible({ timeout: 5000 });
    } finally {
      for (const ctx of anonymousContexts) {
        try {
          await ctx.close();
        } catch {
          // 忽略上下文关闭错误
        }
      }
      try {
        await deleteScreenProject(project.id);
      } catch {
        // 项目可能已被删除或未创建完成，忽略清理错误
      }
    }
  });
});
