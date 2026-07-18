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

  const response = await fetch(`${API_BASE_URL}${requestPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${method} ${requestPath} failed (${response.status}): ${text}`);
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
