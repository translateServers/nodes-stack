import { z } from 'zod';

export const DropdownOptionSchema = z.object({
  label: z.string().describe('显示文本'),
  value: z.string().describe('选项值'),
});

export const DropdownOptionListSchema = z.array(DropdownOptionSchema);

export type DropdownOption = z.infer<typeof DropdownOptionSchema>;
