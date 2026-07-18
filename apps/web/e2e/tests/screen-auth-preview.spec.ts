import { test, expect } from '../fixtures/auth.fixture';
import { register, type AuthTokens } from '../helpers/api-client';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api/v1';

interface ScreenProjectResponse {
  id: string;
  name: string;
  description: string | null;
  canvas: {
    width: number;
    height: number;
    backgroundColor: string;
    scaleMode: string;
    backgroundImage?: string;
  };
  components: unknown[];
  status: 'draft' | 'published';
  thumbnail: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

async function authedRequest<T>(
  tokens: AuthTokens,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokens.accessToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${method} ${path} failed (${response.status}): ${text}`);
  }

  const json = (await response.json()) as ApiResponse<T>;
  if (json.code !== 0) {
    throw new Error(`API ${method} ${path} business error (${json.code}): ${json.message}`);
  }

  return json.data;
}

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createScreenProject(
  tokens: AuthTokens,
  name: string,
): Promise<ScreenProjectResponse> {
  return authedRequest<ScreenProjectResponse>(tokens, 'POST', '/screen', { name });
}

async function publishScreenProject(
  tokens: AuthTokens,
  id: string,
  expectedUpdatedAt: string,
): Promise<ScreenProjectResponse> {
  return authedRequest<ScreenProjectResponse>(tokens, 'POST', `/screen/${id}/publish`, {
    expectedUpdatedAt,
  });
}

test.describe('大屏认证与预览 E2E（任务 10.6）', () => {
  test('未认证用户访问 /screen/:id 重定向到登录页', async ({ page }) => {
    // _app.tsx 的 beforeLoad 在路由挂载前检查 accessToken，缺失即重定向到 /login，
    // 因此无需创建真实项目，使用任意 ID 即可验证守卫行为。
    const fakeId = `nonexistent-${uniqueSuffix()}`;
    await page.goto(`/screen/${fakeId}`);

    await expect(page).toHaveURL(/\/login/);
  });

  test('未认证用户访问 /screen-preview/:id（已发布项目）可以查看', async ({ browser }) => {
    // 独立创建测试数据：注册用户 → 创建项目 → 发布项目
    const suffix = uniqueSuffix();
    const tokens = await register({
      email: `e2e-screen-pub-${suffix}@test.local`,
      username: `e2e_screen_pub_${suffix}`,
      password: 'Test@12345',
      name: 'E2E Screen Published',
    });
    const project = await createScreenProject(tokens, `e2e-pub-${suffix}`);
    const published = await publishScreenProject(tokens, project.id, project.updatedAt);

    // 使用全新未认证上下文访问预览，确保 localStorage 无 accessToken
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(`/screen-preview/${published.id}`);
      await page.waitForLoadState('networkidle');

      // 仍在预览页，未被路由守卫重定向到登录
      await expect(page).toHaveURL(new RegExp(`/screen-preview/${published.id}`));

      // PreviewCanvas 外层 div 带 overflow-hidden 类，loading 与 not-found 状态均无该类
      await expect(page.locator('div.overflow-hidden.bg-black')).toBeVisible();

      // 不显示"不可用"提示
      await expect(page.getByText('大屏项目不存在或未发布')).toBeHidden();
    } finally {
      await context.close();
    }
  });

  test('未认证用户访问 /screen-preview/:id（草稿项目）显示不可用提示', async ({ browser }) => {
    // 独立创建测试数据：注册用户 → 创建项目（createProject 默认 status=draft）
    const suffix = uniqueSuffix();
    const tokens = await register({
      email: `e2e-screen-draft-${suffix}@test.local`,
      username: `e2e_screen_draft_${suffix}`,
      password: 'Test@12345',
      name: 'E2E Screen Draft',
    });
    const project = await createScreenProject(tokens, `e2e-draft-${suffix}`);

    // 使用全新未认证上下文访问预览
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(`/screen-preview/${project.id}`);
      await page.waitForLoadState('networkidle');

      // 仍在预览页，未被路由守卫重定向到登录
      await expect(page).toHaveURL(new RegExp(`/screen-preview/${project.id}`));

      // 公开预览端点对草稿项目返回 404，组件渲染"大屏项目不存在或未发布"
      await expect(page.getByText('大屏项目不存在或未发布')).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
