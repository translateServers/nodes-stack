import { z } from 'zod';
import { FileListSchema } from '@nebula/shared';
import { ENDPOINTS } from '@/api/core/endpoints';
import { del, get } from '@/api/core/http';
import http from '@/api/core/http';

export function getFilesByRowId(rowId: string) {
  return get(`${ENDPOINTS.files}?rowId=${encodeURIComponent(rowId)}`, FileListSchema);
}

export function uploadFile(rowId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return http.post(`${ENDPOINTS.files}/upload?rowId=${encodeURIComponent(rowId)}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export function deleteFile(id: string) {
  return del(`${ENDPOINTS.files}/${id}`);
}

export function getDropdownOptions(type: string) {
  const DropdownOptionSchema = z.object({
    label: z.string(),
    value: z.string(),
  });
  const DropdownOptionListSchema = z.array(DropdownOptionSchema);
  return get(
    `${ENDPOINTS.sheet.dropdownOptions}?type=${encodeURIComponent(type)}`,
    DropdownOptionListSchema,
  );
}
