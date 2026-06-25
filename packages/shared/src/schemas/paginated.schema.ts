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

// 排序查询 schema
export const SortQuerySchema = z.object({
  field: z.string().min(1).describe('排序字段'),
  order: z.enum(['asc', 'desc']).describe('排序方向'),
});

export type SortQueryParams = z.infer<typeof SortQuerySchema>;

// 筛选条件 schema
export const FilterConditionSchema = z.object({
  field: z.string().min(1).describe('筛选字段'),
  operator: z
    .enum([
      'eq',
      'ne',
      'contains',
      'startsWith',
      'endsWith',
      'gt',
      'gte',
      'lt',
      'lte',
      'between',
      'in',
    ])
    .describe('筛选操作符'),
  value: z.unknown().describe('筛选值'),
});

export type FilterConditionParams = z.infer<typeof FilterConditionSchema>;

// 表格查询 schema（分页 + 排序 + 筛选 + 搜索）
export const TableQuerySchema = PaginationQuerySchema.extend({
  sort: z.array(SortQuerySchema).optional().describe('排序条件列表'),
  filters: z.array(FilterConditionSchema).optional().describe('筛选条件列表'),
  search: z.string().optional().describe('全局搜索关键词'),
});

export type TableQueryParams = z.infer<typeof TableQuerySchema>;
