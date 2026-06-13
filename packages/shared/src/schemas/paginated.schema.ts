import { z } from 'zod';

// 分页请求
export const PaginationQuerySchema = z.object({
  page: z.number().int().min(1).default(1).describe('页码'),
  pageSize: z.number().int().min(1).max(100).default(10).describe('每页数量'),
});

// 分页响应
export const PaginatedResponseSchema = z.object({
  total: z.number().int().describe('总数'),
  page: z.number().int().describe('当前页码'),
  pageSize: z.number().int().describe('每页数量'),
  totalPages: z.number().int().describe('总页数'),
});

export type PaginationQueryParams = z.infer<typeof PaginationQuerySchema>;
