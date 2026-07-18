import { type Browser, type BrowserContext, type Page, type Response } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '../fixtures/auth.fixture';
import { type AuthTokens } from '../helpers/api-client';
import { createScreenProject, deleteScreenProject } from '../helpers/screen-api.helper';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_DATA_DIR = path.join(__dirname, '..', 'test-data');

function loadAdminTokens(): AuthTokens {
  const filePath = path.join(TEST_DATA_DIR, 'admin-auth.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as AuthTokens;
}

interface ApiResponseData<T> {
  code: number;
  message: string;
  data: T;
}

interface ScreenProjectSnapshot {
  id: string;
  name: string;
  updatedAt: string;
}

async function parseScreenSnapshot(response: Response): Promise<ScreenProjectSnapshot> {
  const body = (await response.json()) as ApiResponseData<ScreenProjectSnapshot>;
  if (body.code !== 0) {
    throw new Error(`Unexpected business error (${body.code}): ${body.message}`);
  }
  return body.data;
}

/**
 * 创建独立认证浏览器上下文，复用 auth.fixture.ts 的 localStorage 注入策略。
 *
 * 双客户端冲突场景需要两个独立上下文（各自携带 admin token），不能复用 adminPage fixture
 * （单页面），因此在此处手动复制 fixture 的认证注入逻辑。
 */
async function createAuthContext(
  browser: Browser,
): Promise<{ context: BrowserContext; page: Page }> {
  const tokens = loadAdminTokens();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('/');
  await page.evaluate((authTokens: AuthTokens) => {
    const zustandState = {
      state: {
        accessToken: authTokens.accessToken,
        refreshToken: authTokens.refreshToken,
      },
      version: 0,
    };
    localStorage.setItem('nebula-auth', JSON.stringify(zustandState));
  }, tokens);
  await page.reload();
  await page.waitForLoadState('networkidle');

  return { context, page };
}

/** 等待编辑器 GET /screen/:id 响应完成并显示项目名（确认 Store 已加载基线） */
async function loadEditor(page: Page, projectId: string, projectName: string): Promise<void> {
  const editorLoaded = page.waitForResponse(
    (res) =>
      res.url().includes(`/screen/${projectId}`) &&
      !res.url().includes(`${projectId}/`) &&
      res.request().method() === 'GET',
  );
  await page.goto(`/screen/${projectId}`);
  await editorLoaded;
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(projectName)).toBeVisible();
}

/** 触发保存按钮并等待 PATCH /screen/:id 响应 */
async function saveAndWaitResponse(page: Page, projectId: string): Promise<Response> {
  const responsePromise = page.waitForResponse(
    (res) =>
      res.url().includes(`/screen/${projectId}`) &&
      !res.url().includes(`${projectId}/`) &&
      res.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: '保存' }).click();
  return responsePromise;
}

test.describe('双客户端保存冲突 E2E（任务 10.8）', () => {
  test('两个上下文基于同一 updatedAt 提交，先保存者成功，后保存者出现冲突 UI', async ({
    browser,
  }) => {
    const ts = Date.now();
    const project = await createScreenProject({ name: `e2e-conflict-${ts}` });
    const contexts: BrowserContext[] = [];

    try {
      // 1. 创建两个独立认证上下文（各自携带 admin token）
      const ctxA = await createAuthContext(browser);
      const ctxB = await createAuthContext(browser);
      contexts.push(ctxA.context, ctxB.context);

      // 2. 两个上下文加载同一项目 → Store 基线均为初始 updatedAt
      await loadEditor(ctxA.page, project.id, `e2e-conflict-${ts}`);
      await loadEditor(ctxB.page, project.id, `e2e-conflict-${ts}`);

      // 3. 上下文 A 先保存：成功，服务端 updatedAt 切换为新基线
      const responseA = await saveAndWaitResponse(ctxA.page, project.id);
      expect(responseA.ok()).toBe(true);
      const serverSnapshotAfterA = await parseScreenSnapshot(responseA);
      // 服务端 updatedAt 已变化（与初始基线不同）
      expect(serverSnapshotAfterA.updatedAt).not.toBe(project.updatedAt);
      await ctxA.page.waitForLoadState('networkidle');

      // 4. 上下文 B 后保存：服务端 expectedUpdatedAt 校验失败，返回 409
      const responseB = await saveAndWaitResponse(ctxB.page, project.id);
      expect(responseB.status()).toBe(409);

      // 5. 后保存者出现冲突 UI（任务 9.3 接入的 SaveConflictDialog）
      await expect(ctxB.page.getByRole('alertdialog')).toBeVisible();
      await expect(ctxB.page.getByText('保存冲突')).toBeVisible();
      await expect(
        ctxB.page.getByText('项目已在其他窗口或会话中被修改。重新加载将放弃当前未保存内容。'),
      ).toBeVisible();

      // 6. 后保存者取消：对话框关闭，本地内容仍在（Store 基线未变）
      await ctxB.page.getByRole('button', { name: '继续编辑' }).click();
      await expect(ctxB.page.getByRole('alertdialog')).toBeHidden();
      // 本地项目名仍可见（编辑器未卸载，本地内容未被清空）
      await expect(ctxB.page.getByText(`e2e-conflict-${ts}`)).toBeVisible();

      // 7. 取消后再次保存：基线仍为旧值，依旧冲突（证明取消未更新基线，本地内容仍在）
      const responseB2 = await saveAndWaitResponse(ctxB.page, project.id);
      expect(responseB2.status()).toBe(409);
      await expect(ctxB.page.getByRole('alertdialog')).toBeVisible();

      // 8. 后保存者选择"重新加载"：refetch 服务端最新版本 → loadProject 覆盖 Store
      const refetchPromise = ctxB.page.waitForResponse(
        (res) =>
          res.url().includes(`/screen/${project.id}`) &&
          !res.url().includes(`${project.id}/`) &&
          res.request().method() === 'GET',
      );
      await ctxB.page.getByRole('button', { name: '重新加载' }).click();
      const refetchResponse = await refetchPromise;
      expect(refetchResponse.ok()).toBe(true);
      const serverSnapshotAfterReload = await parseScreenSnapshot(refetchResponse);
      // 服务端内容仍为 A 的版本（updatedAt 与 A 保存响应一致）
      expect(serverSnapshotAfterReload.updatedAt).toBe(serverSnapshotAfterA.updatedAt);
      await ctxB.page.waitForLoadState('networkidle');
      // 对话框已关闭
      await expect(ctxB.page.getByRole('alertdialog')).toBeHidden();

      // 9. 重新加载后再次保存：Store 基线已切换为服务端版本，不再冲突
      const responseB3 = await saveAndWaitResponse(ctxB.page, project.id);
      expect(responseB3.ok()).toBe(true);
      await expect(ctxB.page.getByRole('alertdialog')).toBeHidden();
    } finally {
      for (const ctx of contexts) {
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
