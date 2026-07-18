import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScreenProjectSchema, type ScreenProject } from '@nebula/shared';
import { ENDPOINTS } from '@/api/core/endpoints';
import { publishScreenProject, updateScreenProject } from './api';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));

vi.mock('@/api/core/http', () => mocks);

const BASELINE_UPDATED_AT = '2025-06-01 10:30:45';
const SERVER_UPDATED_AT = '2025-06-01 11:00:00';

const mockScreenProject: ScreenProject = {
  id: 'screen-1',
  name: '测试大屏',
  description: null,
  canvas: {
    width: 1920,
    height: 1080,
    backgroundColor: '#000000',
    scaleMode: 'fit',
  },
  components: [],
  status: 'draft',
  thumbnail: null,
  createdAt: '2025-06-01 10:00:00',
  updatedAt: SERVER_UPDATED_AT,
};

describe('screen api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateScreenProject', () => {
    it('更新请求体应包含 expectedUpdatedAt', async () => {
      mocks.patch.mockResolvedValue(mockScreenProject);

      await updateScreenProject('screen-1', {
        expectedUpdatedAt: BASELINE_UPDATED_AT,
        name: '新名称',
      });

      expect(mocks.patch).toHaveBeenCalledWith(
        `${ENDPOINTS.screen}/screen-1`,
        expect.objectContaining({ expectedUpdatedAt: BASELINE_UPDATED_AT }),
        ScreenProjectSchema,
      );
    });

    it('更新请求体应原样传递 name 字段', async () => {
      mocks.patch.mockResolvedValue(mockScreenProject);

      await updateScreenProject('screen-1', {
        expectedUpdatedAt: BASELINE_UPDATED_AT,
        name: '新名称',
      });

      const body: unknown = mocks.patch.mock.calls[0]?.[1];
      expect(body).toEqual(
        expect.objectContaining({
          expectedUpdatedAt: BASELINE_UPDATED_AT,
          name: '新名称',
        }),
      );
    });

    it('更新响应应包含服务端 updatedAt', async () => {
      mocks.patch.mockResolvedValue(mockScreenProject);

      const result = await updateScreenProject('screen-1', {
        expectedUpdatedAt: BASELINE_UPDATED_AT,
      });

      expect(result.updatedAt).toBe(SERVER_UPDATED_AT);
    });
  });

  describe('publishScreenProject', () => {
    it('发布请求体应包含 expectedUpdatedAt', async () => {
      mocks.post.mockResolvedValue(mockScreenProject);

      await publishScreenProject('screen-1', {
        expectedUpdatedAt: BASELINE_UPDATED_AT,
      });

      expect(mocks.post).toHaveBeenCalledWith(
        `${ENDPOINTS.screen}/screen-1/publish`,
        expect.objectContaining({ expectedUpdatedAt: BASELINE_UPDATED_AT }),
        ScreenProjectSchema,
      );
    });

    it('发布请求体应仅含 expectedUpdatedAt，不携带画布或组件内容', async () => {
      mocks.post.mockResolvedValue(mockScreenProject);

      await publishScreenProject('screen-1', {
        expectedUpdatedAt: BASELINE_UPDATED_AT,
      });

      const body: unknown = mocks.post.mock.calls[0]?.[1];
      expect(body).toEqual({ expectedUpdatedAt: BASELINE_UPDATED_AT });
    });

    it('发布响应应包含服务端 updatedAt', async () => {
      mocks.post.mockResolvedValue(mockScreenProject);

      const result = await publishScreenProject('screen-1', {
        expectedUpdatedAt: BASELINE_UPDATED_AT,
      });

      expect(result.updatedAt).toBe(SERVER_UPDATED_AT);
    });
  });
});
