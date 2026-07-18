import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ScreenComponent, ScreenProject } from '@nebula/shared';
import { type AuthTokens } from './api-client';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api/v1';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_DATA_DIR = path.join(__dirname, '..', 'test-data');

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

function loadTokens(role: 'admin' | 'viewer'): AuthTokens {
  const filePath = path.join(TEST_DATA_DIR, `${role}-auth.json`);
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as AuthTokens;
}

async function request<T>(
  method: string,
  requestPath: string,
  body?: unknown,
  tokens?: AuthTokens,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (tokens) {
    headers.Authorization = `Bearer ${tokens.accessToken}`;
  }

  // E2E 并发创建项目可能触发 NestJS Throttler 429 限流，重试 3 次
  const maxRetries = 3;
  let response: Response | undefined;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    response = await fetch(`${API_BASE_URL}${requestPath}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status !== 429) break;
    // 429 限流：等待 500ms 后重试
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (!response || !response.ok) {
    const text = response ? await response.text() : 'no response';
    throw new Error(`API ${method} ${requestPath} failed (${response?.status}): ${text}`);
  }

  const json = (await response.json()) as ApiResponse<T>;
  if (json.code !== 0) {
    throw new Error(`API ${method} ${requestPath} business error (${json.code}): ${json.message}`);
  }

  return json.data;
}

export interface CreateScreenProjectParams {
  name: string;
  description?: string;
  canvas?: {
    width?: number;
    height?: number;
    backgroundColor?: string;
    backgroundImage?: string;
    scaleMode?: 'fit' | 'full' | 'width' | 'height' | 'none';
  };
}

export async function createScreenProject(
  params: CreateScreenProjectParams,
): Promise<ScreenProject> {
  const tokens = loadTokens('admin');
  return request<ScreenProject>('POST', '/screen', params, tokens);
}

export interface UpdateScreenProjectParams {
  name?: string;
  description?: string;
  canvas?: {
    width?: number;
    height?: number;
    backgroundColor?: string;
    backgroundImage?: string;
    scaleMode?: 'fit' | 'full' | 'width' | 'height' | 'none';
  };
  components?: ScreenComponent[];
  thumbnail?: string;
  expectedUpdatedAt: string;
}

export async function updateScreenProject(
  id: string,
  params: UpdateScreenProjectParams,
): Promise<ScreenProject> {
  const tokens = loadTokens('admin');
  return request<ScreenProject>('PATCH', `/screen/${id}`, params, tokens);
}

export async function publishScreenProject(
  id: string,
  params: { expectedUpdatedAt: string },
): Promise<ScreenProject> {
  const tokens = loadTokens('admin');
  return request<ScreenProject>('POST', `/screen/${id}/publish`, params, tokens);
}

export async function deleteScreenProject(id: string): Promise<void> {
  const tokens = loadTokens('admin');
  await request<void>('DELETE', `/screen/${id}`, undefined, tokens);
}

export async function getScreenPreview(id: string): Promise<ScreenProject | null> {
  // 公开预览端点不需要 token；草稿或不存在时返回 404，调用方据此判断可见性
  try {
    return await request<ScreenProject>('GET', `/screen/${id}/preview`);
  } catch {
    return null;
  }
}

/**
 * 构造一个带非零旋转与公共样式字段的文本组件，用于断言共享样式效果。
 *
 * 共享样式由 resolveComponentContainerStyle 解析，预览容器会渲染为：
 * `transform: rotate(<rotation>deg)` + `backgroundColor` + `borderRadius` 等。
 */
export function createTextComponent(overrides?: Partial<ScreenComponent>): ScreenComponent {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return {
    id: `e2e-text-${ts}-${rand}`,
    type: 'text',
    name: 'E2E 文本',
    position: {
      x: 200,
      y: 200,
      width: 500,
      height: 100,
      rotation: 45, // 非零旋转，用于断言共享样式效果
    },
    style: {
      backgroundColor: '#1e293b',
      borderRadius: 8,
      borderWidth: 2,
      borderColor: '#3b82f6',
      borderStyle: 'solid',
      opacity: 0.9,
    },
    props: { content: 'E2E 旋转文本' },
    status: { locked: false, hidden: false },
    zIndex: 1,
    parentId: null,
    ...overrides,
  };
}

/**
 * 任务 10.1：编辑器交互 E2E 数据工厂
 *
 * 构造各类组件用于 E2E 测试，每个组件带有唯一 ID（基于时间戳+随机数），
 * 不依赖固定项目 ID 或用例顺序。所有组件默认 parentId=null（顶层）。
 */

/** 生成唯一 ID：前缀 + 时间戳 + 随机字符串 */
function uniqueId(prefix: string): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${ts}-${rand}`;
}

/** 构造矩形组件 */
export function createRectComponent(overrides?: Partial<ScreenComponent>): ScreenComponent {
  return {
    id: uniqueId('e2e-rect'),
    type: 'rect',
    name: 'E2E 矩形',
    position: { x: 100, y: 100, width: 200, height: 120 },
    style: {
      backgroundColor: '#3b82f6',
      borderWidth: 0,
      borderColor: '#1e40af',
      borderRadius: 0,
    },
    props: {},
    status: { locked: false, hidden: false },
    zIndex: 1,
    parentId: null,
    ...overrides,
  };
}

/** 构造椭圆组件 */
export function createEllipseComponent(overrides?: Partial<ScreenComponent>): ScreenComponent {
  return {
    id: uniqueId('e2e-ellipse'),
    type: 'ellipse',
    name: 'E2E 椭圆',
    position: { x: 400, y: 100, width: 200, height: 200 },
    style: {
      backgroundColor: '#10b981',
      borderWidth: 0,
      borderColor: '#047857',
    },
    props: {},
    status: { locked: false, hidden: false },
    zIndex: 2,
    parentId: null,
    ...overrides,
  };
}

/** 构造分组组件：parentId 指向分组 ID */
export function createGroupedComponent(
  groupId: string,
  overrides?: Partial<ScreenComponent>,
): ScreenComponent {
  return createRectComponent({
    parentId: groupId,
    ...overrides,
  });
}

/**
 * 创建一个包含多个不同类型组件的项目，用于组合交互 E2E。
 * 返回的项目包含：1 个文本 + 2 个矩形 + 1 个椭圆，均已设置 zIndex。
 */
export async function createProjectWithMixedComponents(
  namePrefix: string,
): Promise<{ project: ScreenProject; components: ScreenComponent[] }> {
  const ts = Date.now();
  const project = await createScreenProject({ name: `${namePrefix}-${ts}` });

  const text = createTextComponent({
    name: 'E2E 文本-A',
    props: { content: 'E2E-组合交互文本' },
    position: { x: 50, y: 50, width: 300, height: 60, rotation: 0 },
    style: { color: '#ffffff', fontSize: 16, backgroundColor: '#1e293b' },
    zIndex: 1,
  });
  const rect1 = createRectComponent({
    name: 'E2E 矩形-A',
    position: { x: 100, y: 200, width: 200, height: 120 },
    zIndex: 2,
  });
  const rect2 = createRectComponent({
    name: 'E2E 矩形-B',
    position: { x: 400, y: 200, width: 200, height: 120 },
    style: { backgroundColor: '#ef4444', borderWidth: 0, borderColor: '#991b1b', borderRadius: 0 },
    zIndex: 3,
  });
  const ellipse = createEllipseComponent({
    name: 'E2E 椭圆-A',
    position: { x: 250, y: 400, width: 150, height: 150 },
    zIndex: 4,
  });

  const components = [text, rect1, rect2, ellipse];
  const updated = await updateScreenProject(project.id, {
    components,
    expectedUpdatedAt: project.updatedAt,
  });

  return { project: updated, components };
}

/**
 * 任务 10.1：创建包含分组的项目，用于双击进入分组 E2E。
 *
 * 构造一个分组（parentId 链）：
 * - 1 个分组容器（type='group'，但实际上 Nebula 使用 parentId 表达分组关系）
 * - 2 个分组内成员（parentId = groupId）
 * - 1 个顶层组件（parentId=null）
 *
 * 注意：Nebula 的分组通过组件 parentId 关联，无独立 group 类型。
 * 这里我们创建一个虚拟"分组节点"作为 parentId 引用。
 */
export async function createProjectWithGroup(namePrefix: string): Promise<{
  project: ScreenProject;
  groupId: string;
  groupChildren: ScreenComponent[];
  topLevelComponent: ScreenComponent;
}> {
  const ts = Date.now();
  const project = await createScreenProject({ name: `${namePrefix}-${ts}` });

  const groupId = uniqueId('e2e-group');
  const child1 = createRectComponent({
    id: uniqueId('e2e-group-child-1'),
    name: '分组子-1',
    position: { x: 100, y: 100, width: 80, height: 80 },
    parentId: groupId,
    zIndex: 1,
  });
  const child2 = createRectComponent({
    id: uniqueId('e2e-group-child-2'),
    name: '分组子-2',
    position: { x: 200, y: 100, width: 80, height: 80 },
    style: { backgroundColor: '#ef4444', borderWidth: 0, borderColor: '#991b1b', borderRadius: 0 },
    parentId: groupId,
    zIndex: 2,
  });
  // 顶层文本组件位置需在可见画布区域内（canvasSurface 宽度约 428px、高度约 615px），
  // 避免其中心点落到右侧 PropertyPanel 上导致 click hit-test 被拦截。
  // 子组件位于 y=[100,180]，顶层文本放在 y=400 避免重叠。
  const topLevel = createTextComponent({
    name: '顶层文本',
    props: { content: 'E2E-顶层文本' },
    position: { x: 100, y: 400, width: 200, height: 60, rotation: 0 },
    zIndex: 3,
  });

  const components = [child1, child2, topLevel];
  const updated = await updateScreenProject(project.id, {
    components,
    expectedUpdatedAt: project.updatedAt,
  });

  return {
    project: updated,
    groupId,
    groupChildren: [child1, child2],
    topLevelComponent: topLevel,
  };
}
