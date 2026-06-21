import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getFilesByRowId as _getFilesByRowId,
  uploadFile as _uploadFile,
  deleteFile as _deleteFile,
  getDropdownOptions as _getDropdownOptions,
} from './api';

// ──────────────────────── 文件管理 ────────────────────────

export function useFilesByRowId(rowId: string) {
  return useQuery({
    queryKey: ['files', rowId],
    queryFn: () => _getFilesByRowId(rowId),
    enabled: Boolean(rowId),
  });
}

export function useUploadFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ rowId, file }: { rowId: string; file: File }) => _uploadFile(rowId, file),
    onSuccess: async (_, { rowId }) => {
      await queryClient.invalidateQueries({ queryKey: ['files', rowId] });
    },
  });
}

export function useDeleteFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => _deleteFile(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['files'] });
    },
  });
}

// ──────────────────────── 下拉选项 ────────────────────────

export function useDropdownOptions(type: string) {
  return useQuery({
    queryKey: ['dropdown-options', type],
    queryFn: () => _getDropdownOptions(type),
    enabled: Boolean(type),
  });
}
