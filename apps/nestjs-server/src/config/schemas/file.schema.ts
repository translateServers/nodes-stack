import { z } from 'zod';

export const FileConfigSchema = z.object({
  uploadDir: z.string().default('./uploads'),
  maxFileSize: z.coerce.number().int().positive().default(10485760),
});

export type FileConfig = z.infer<typeof FileConfigSchema>;
