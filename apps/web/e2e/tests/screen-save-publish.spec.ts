import { type BrowserContext, type Page } from '@playwright/test';
import { test, expect } from '../fixtures/auth.fixture';
import {
  createScreenProject,
  updateScreenProject,
  publishScreenProject,
  deleteScreenProject,
  createTextComponent,
} from '../helpers/screen-api.helper';

test.describe('保存后发布 E2E（任务 10.7）', () => {
  test('认证用户保存已发布项目后，匿名预览变为不可用', async ({ adminPage, browser }) => {
    // 每个测试独立创建数据：通过 API 创建带非零旋转文本组件的项目并发布
    const ts = Date.now();
    const project = await createScreenProject({
      name: `e2e-save-unavailable-${ts}`,
    });
    const textComponent = createTextComponent({
      props: { content: 'E2E-保存后预览不可用' },
    });

    const anonymousContexts: BrowserContext[] = [];
    try {
      const updated = await updateScreenProject(project.id, {
        components: [textComponent],
        expectedUpdatedAt: project.updatedAt,
      });
      const published = await publishScreenProject(updated.id, {
        expectedUpdatedAt: updated.updatedAt,
      });

      // 1. 已发布状态：匿名预览可见内容
      const anonCtx1 = await browser.newContext();
      anonymousContexts.push(anonCtx1);
      const previewPage1 = await anonCtx1.newPage();
      await previewPage1.goto(`/screen-preview/${published.id}`);
      await previewPage1.waitForLoadState('networkidle');
      await expect(previewPage1.getByText('E2E-保存后预览不可用')).toBeVisible();

      // 2. 认证用户访问编辑器（命中受保护路由 /screen/:id）
      const editorLoaded = adminPage.waitForResponse(
        (res) =>
          res.url().includes(`/screen/${published.id}`) &&
          !res.url().includes(`${published.id}/`) &&
          res.request().method() === 'GET',
      );
      await adminPage.goto(`/screen/${published.id}`);
      await editorLoaded;
      await adminPage.waitForLoadState('networkidle');
      // 等待编辑器工具栏显示项目名称（确认项目已加载到 Store）
      await expect(adminPage.getByText(`e2e-save-unavailable-${ts}`)).toBeVisible();

      // 3. 点击保存按钮：已发布项目保存后 status 变为 draft，预览不可用
      const saveResponse = adminPage.waitForResponse(
        (res) =>
          res.url().includes(`/screen/${published.id}`) &&
          !res.url().includes(`${published.id}/`) &&
          res.request().method() === 'PATCH',
      );
      await adminPage.getByRole('button', { name: '保存' }).click();
      await saveResponse;
      await adminPage.waitForLoadState('networkidle');

      // 4. 匿名预览变为不可用（draft 状态下公开预览端点返回 404）
      const anonCtx2 = await browser.newContext();
      anonymousContexts.push(anonCtx2);
      const previewPage2 = await anonCtx2.newPage();
      await previewPage2.goto(`/screen-preview/${published.id}`);
      await previewPage2.waitForLoadState('networkidle');
      await expect(previewPage2.getByText('大屏项目不存在或未发布')).toBeVisible();
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

  test('再次发布后，匿名预览展示新保存内容与共享样式', async ({ adminPage, browser }) => {
    // 每个测试独立创建数据
    const ts = Date.now();
    const project = await createScreenProject({
      name: `e2e-republish-${ts}`,
    });
    // 非零旋转（30 度）用于断言共享样式效果
    const textComponent = createTextComponent({
      position: { x: 200, y: 200, width: 500, height: 100, rotation: 30 },
      props: { content: 'E2E-再次发布内容' },
    });

    const anonymousContexts: BrowserContext[] = [];
    try {
      const updated = await updateScreenProject(project.id, {
        components: [textComponent],
        expectedUpdatedAt: project.updatedAt,
      });
      const published = await publishScreenProject(updated.id, {
        expectedUpdatedAt: updated.updatedAt,
      });

      // 1. 已发布状态：匿名预览可见内容与非零旋转共享样式
      const anonCtx1 = await browser.newContext();
      anonymousContexts.push(anonCtx1);
      const previewPage1 = await anonCtx1.newPage();
      await previewPage1.goto(`/screen-preview/${published.id}`);
      await previewPage1.waitForLoadState('networkidle');
      await expect(previewPage1.getByText('E2E-再次发布内容')).toBeVisible();
      // 断言非零旋转共享样式：容器 div 的 transform 应为 rotate(30deg)
      // resolveComponentContainerStyle（任务 3.1）将 position.rotation 解析为 transform
      await assertRotationTransform(previewPage1, 'E2E-再次发布内容', 'rotate(30deg)');

      // 2. 认证用户访问编辑器
      const editorLoaded = adminPage.waitForResponse(
        (res) =>
          res.url().includes(`/screen/${published.id}`) &&
          !res.url().includes(`${published.id}/`) &&
          res.request().method() === 'GET',
      );
      await adminPage.goto(`/screen/${published.id}`);
      await editorLoaded;
      await adminPage.waitForLoadState('networkidle');
      await expect(adminPage.getByText(`e2e-republish-${ts}`)).toBeVisible();

      // 3. 保存：status 变为 draft，预览不可用
      const saveResponse = adminPage.waitForResponse(
        (res) =>
          res.url().includes(`/screen/${published.id}`) &&
          !res.url().includes(`${published.id}/`) &&
          res.request().method() === 'PATCH',
      );
      await adminPage.getByRole('button', { name: '保存' }).click();
      await saveResponse;
      await adminPage.waitForLoadState('networkidle');

      // 4. 匿名预览不可用
      const anonCtx2 = await browser.newContext();
      anonymousContexts.push(anonCtx2);
      const previewPage2 = await anonCtx2.newPage();
      await previewPage2.goto(`/screen-preview/${published.id}`);
      await previewPage2.waitForLoadState('networkidle');
      await expect(previewPage2.getByText('大屏项目不存在或未发布')).toBeVisible();

      // 5. 再次发布：status 变为 published（任务 8.5 已确保发布后公开预览缓存失效）
      const publishResponse = adminPage.waitForResponse(
        (res) =>
          res.url().includes(`/screen/${published.id}/publish`) &&
          res.request().method() === 'POST',
      );
      await adminPage.getByRole('button', { name: '发布' }).click();
      await publishResponse;
      await adminPage.waitForLoadState('networkidle');

      // 6. 匿名预览展示新保存内容与共享样式
      const anonCtx3 = await browser.newContext();
      anonymousContexts.push(anonCtx3);
      const previewPage3 = await anonCtx3.newPage();
      await previewPage3.goto(`/screen-preview/${published.id}`);
      await previewPage3.waitForLoadState('networkidle');
      await expect(previewPage3.getByText('E2E-再次发布内容')).toBeVisible();
      // 断言非零旋转共享样式：发布后预览展示与编辑器一致的旋转效果
      await assertRotationTransform(previewPage3, 'E2E-再次发布内容', 'rotate(30deg)');
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

/**
 * 断言预览页面的组件容器渲染了非零旋转的共享样式。
 *
 * resolveComponentContainerStyle（任务 3.1）将 position.rotation 解析为
 * `transform: rotate(<rotation>deg)`，预览容器 div 会内联此样式。
 * 从包含文本的元素向上遍历到容器 div，断言 transform 包含期望的旋转值。
 */
async function assertRotationTransform(
  page: Page,
  textContent: string,
  expectedTransform: string,
): Promise<void> {
  const transform = await page
    .getByText(textContent)
    .first()
    .evaluate((el) => {
      let current: HTMLElement | null = el as HTMLElement;
      while (current && current !== document.body) {
        const t = current.style.transform;
        if (t) return t;
        current = current.parentElement;
      }
      return '';
    });
  expect(transform).toContain(expectedTransform);
}
