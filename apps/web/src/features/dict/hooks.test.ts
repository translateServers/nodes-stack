import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '../../../test/utils';
import * as dictApi from './api';
import { useDictTypes, useDictValues, useCreateDictType, useDeleteDictType } from './hooks';

vi.mock('./api', () => ({
  getDictTypes: vi.fn(),
  getDictTypeById: vi.fn(),
  createDictType: vi.fn(),
  updateDictType: vi.fn(),
  deleteDictType: vi.fn(),
  getDictValues: vi.fn(),
  createDictValue: vi.fn(),
  updateDictValue: vi.fn(),
  deleteDictValue: vi.fn(),
}));

describe('useDictTypes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch dict types', async () => {
    const mockTypes = [
      {
        id: '1',
        code: 'user_status',
        name: '用户状态',
        sort: 0,
        isActive: true,
        remark: null,
        createdAt: '2025-06-01 10:00:00',
        updatedAt: '2025-06-01 10:00:00',
      },
    ];
    vi.mocked(dictApi.getDictTypes).mockResolvedValue(mockTypes);

    const { result } = renderHook(() => useDictTypes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].code).toBe('user_status');
  });
});

describe('useDictValues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch dict values for a type', async () => {
    const mockValues = [
      {
        id: '1',
        dictTypeId: 't1',
        code: 'active',
        label: '启用',
        value: '1',
        color: null,
        sort: 0,
        remark: null,
        isActive: true,
        createdAt: '2025-06-01 10:00:00',
        updatedAt: '2025-06-01 10:00:00',
      },
    ];
    vi.mocked(dictApi.getDictValues).mockResolvedValue(mockValues);

    const { result } = renderHook(() => useDictValues('t1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.[0].code).toBe('active');
  });

  it('should not fetch when typeId is empty', () => {
    const { result } = renderHook(() => useDictValues(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(dictApi.getDictValues).not.toHaveBeenCalled();
  });
});

describe('useCreateDictType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a dict type', async () => {
    vi.mocked(dictApi.createDictType).mockResolvedValue({
      id: '2',
      code: 'new_type',
      name: '新类型',
      sort: 0,
      isActive: true,
      remark: null,
      createdAt: '2025-06-01 10:00:00',
      updatedAt: '2025-06-01 10:00:00',
    });

    const { result } = renderHook(() => useCreateDictType(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ code: 'new_type', name: '新类型' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(dictApi.createDictType).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'new_type', name: '新类型' }),
    );
  });
});

describe('useDeleteDictType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete a dict type', async () => {
    vi.mocked(dictApi.deleteDictType).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteDictType(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('type-id');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(dictApi.deleteDictType).toHaveBeenCalledWith('type-id');
  });
});
