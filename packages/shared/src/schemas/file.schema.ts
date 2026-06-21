import { z } from 'zod';

export const FileSchema = z.object({
  id: z.string().describe('文件 ID'),
  rowId: z.string().describe('关联业务行 ID'),
  fileName: z.string().describe('文件名'),
  fileSize: z.number().describe('文件大小（字节）'),
  mimeType: z.string().describe('MIME 类型'),
  createdAt: z.string().describe('上传时间'),
  updatedAt: z.string().describe('更新时间'),
});

export const FileListSchema = z.array(FileSchema);

export type FileResponse = z.infer<typeof FileSchema>;
