/**
 * 事件蓝图动作 E2E（任务 7.2 - part 2）
 *
 * 覆盖：
 * - pageLoad 触发：预览页加载后自动执行动作（无需点击）
 * - navigate URL 白名单：javascript: URL 在配置层（Schema superRefine）被拒绝
 *
 * 设计：
 * - pageLoad：通过 chain blueprint 验证触发器 → 多动作链式执行
 * - URL 白名单：调用 updateScreenProjectRaw 断言返回 400（nestjs-zod 全局管道校验失败）
 */

import { expect, test } from '../fixtures/auth.fixture';
import {
  createRectComponent,
  createEllipseComponent,
  deleteScreenProject,
  createScreenProject,
  updateScreenProjectRaw,
} from '../helpers/screen-api.helper';
import {
  buildBlueprint,
  buildChainBlueprint,
  setupProjectWithBlueprint,
  openAnonymousPreview,
} from '../helpers/blueprint-action.helper';

test.describe('事件蓝图动作 E2E - pageLoad 触发（任务 7.2）', () => {
  test('预览页加载后自动执行 pageLoad → setVisibility 链', async ({ browser }) => {
    // 准备：B 默认可见（status.hidden=false），C 默认隐藏（status.hidden=true）
    // 蓝图：pageLoad → setVisibility(B, hide) → setVisibility(C, show)
    // 预期：预览页加载后 B 自动隐藏、C 自动显示
    const componentA = createRectComponent({
      name: '触发占位',
      position: { x: 100, y: 100, width: 120, height: 80 },
    });
    const componentB = createRectComponent({
      name: 'B-默认可见',
      position: { x: 300, y: 100, width: 120, height: 80 },
      status: { locked: false, hidden: false },
    });
    const componentC = createEllipseComponent({
      name: 'C-默认隐藏',
      position: { x: 500, y: 100, width: 120, height: 80 },
      status: { locked: false, hidden: true },
    });
    const ts = Date.now();
    const { projectId } = await setupProjectWithBlueprint({
      name: `e2e-bp-pageload-${ts}`,
      components: [componentA, componentB, componentC],
      blueprint: buildChainBlueprint(
        'trig-pageload',
        { type: 'pageLoad' },
        'act-hide-b',
        { type: 'setVisibility', targetComponentId: componentB.id, visible: 'hide' },
        'act-show-c',
        { type: 'setVisibility', targetComponentId: componentC.id, visible: 'show' },
      ),
    });

    try {
      const { page, dispose } = await openAnonymousPreview(browser, projectId);
      try {
        const componentBEl = page.locator(`[data-preview-component-id="${componentB.id}"]`);
        const componentCEl = page.locator(`[data-preview-component-id="${componentC.id}"]`);

        // pageLoad 触发后：B 自动隐藏（visibilityOverrides 覆盖 status.hidden=false）
        await expect(componentBEl).not.toBeVisible({ timeout: 5000 });
        // pageLoad 触发后：C 自动显示（visibilityOverrides 覆盖 status.hidden=true）
        await expect(componentCEl).toBeVisible({ timeout: 5000 });
      } finally {
        await dispose();
      }
    } finally {
      await deleteScreenProject(projectId).catch(() => {});
    }
  });
});

test.describe('事件蓝图动作 E2E - navigate URL 白名单（任务 7.2）', () => {
  test('javascript: URL 在 Schema 层被拒绝（API 返回 400）', async () => {
    // 准备：创建项目，直接 PATCH 含 javascript: URL 的蓝图
    const ts = Date.now();
    const project = await createScreenProject({ name: `e2e-bp-url-reject-${ts}` });

    try {
      // 构造含 javascript: URL 的非法蓝图
      const invalidBlueprint = buildBlueprint({
        triggerId: 'trig-bad-url',
        triggerConfig: { type: 'pageLoad' },
        actionId: 'act-bad-url',
        actionConfig: { type: 'navigate', url: 'javascript:alert(1)', target: '_blank' },
      });

      // 直接 PATCH 调用，绕过 helper 的 throw 逻辑，断言原始响应
      const response = await updateScreenProjectRaw(project.id, {
        blueprint: invalidBlueprint,
        expectedUpdatedAt: project.updatedAt,
      });

      // Schema superRefine 拒绝 → nestjs-zod 抛 BadRequestException → HTTP 400
      expect(response.status).toBe(400);

      // NestJS 全局异常过滤器将 ZodValidationException 的 message 设为通用"请求参数校验失败"，
      // 具体 zod issue 详情放入 details: string[] 字段（http-exception.filter.ts 第 112-120 行）
      const body = (await response.json()) as {
        code?: number;
        message?: string | string[];
        details?: string[];
      };
      expect(body.code).toBeDefined();
      // 通用校验失败 message
      const message = Array.isArray(body.message) ? body.message.join(' ') : (body.message ?? '');
      expect(message).toMatch(/校验/);
      // details 字段含具体 zod issue，应提及 URL 或协议白名单相关关键词
      const detailsText = Array.isArray(body.details) ? body.details.join(' ') : '';
      expect(detailsText).toMatch(/url|协议|http|https|javascript/i);
    } finally {
      await deleteScreenProject(project.id).catch(() => {});
    }
  });
});
