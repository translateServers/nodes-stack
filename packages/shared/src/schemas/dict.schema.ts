import { z } from 'zod';
import { DateTimeStringSchema } from './datetime.schema.js';

// 字典类型
export const DictTypeSchema = z.object({
  id: z.string().describe('字典类型唯一标识'),
  code: z.string().describe('字典类型编码'),
  name: z.string().describe('字典类型名称'),
  description: z.string().nullable().optional().describe('描述'),
  createdAt: DateTimeStringSchema.describe('创建时间'),
  updatedAt: DateTimeStringSchema.describe('更新时间'),
});

// 字典值
export const DictValueSchema = z.object({
  id: z.string().describe('字典值唯一标识'),
  code: z.string().describe('字典值编码'),
  label: z.string().describe('字典值标签'),
  value: z.string().describe('字典值'),
  sort: z.number().describe('排序'),
  dictTypeId: z.string().describe('所属字典类型 ID'),
  createdAt: DateTimeStringSchema.describe('创建时间'),
  updatedAt: DateTimeStringSchema.describe('更新时间'),
});

// 字典类型（含值列表）
export const DictTypeWithValuesSchema = DictTypeSchema.extend({
  values: z.array(DictValueSchema).describe('字典值列表'),
});

// 创建字典类型
export const CreateDictTypeSchema = z.object({
  code: z.string().min(1, '编码不能为空').describe('字典类型编码'),
  name: z.string().min(1, '名称不能为空').describe('字典类型名称'),
  description: z.string().optional().describe('描述'),
});

// 创建字典值
export const CreateDictValueSchema = z.object({
  code: z.string().min(1, '编码不能为空').describe('字典值编码'),
  label: z.string().min(1, '标签不能为空').describe('字典值标签'),
  value: z.string().min(1, '值不能为空').describe('字典值'),
  sort: z.number().int().min(0).optional().describe('排序'),
  dictTypeId: z.string().min(1, '字典类型 ID 不能为空').describe('所属字典类型 ID'),
});

export type DictTypeResponse = z.infer<typeof DictTypeSchema>;
export type DictValueResponse = z.infer<typeof DictValueSchema>;
export type DictTypeWithValuesResponse = z.infer<typeof DictTypeWithValuesSchema>;
export type CreateDictTypeParams = z.infer<typeof CreateDictTypeSchema>;
export type CreateDictValueParams = z.infer<typeof CreateDictValueSchema>;
