import type { z } from 'zod';

interface ResolverSuccess<T> {
  values: T;
  errors: Record<string, never>;
}

interface ResolverFailure {
  values: Record<string, never>;
  errors: Record<string, { type: string; message: string }>;
}

type ResolverResult<T> = ResolverSuccess<T> | ResolverFailure;

/**
 * Zod 4 兼容的 react-hook-form resolver 工厂。
 * 返回的函数签名与 react-hook-form Resolver 兼容，但避免直接引用其类型
 * （因为 Resolver 的泛型约束与 Zod 4 的 output 类型不兼容）。
 */
export function zodResolver<TSchema extends z.ZodObject<z.ZodRawShape>>(
  schema: TSchema,
): (values: unknown) => Promise<ResolverResult<z.infer<TSchema>>> {
  return async (values: unknown) => {
    const result = await schema.safeParseAsync(values);

    if (result.success) {
      return { values: result.data, errors: {} as Record<string, never> };
    }

    const errors: Record<string, { type: string; message: string }> = {};

    for (const issue of result.error.issues) {
      const path = issue.path.join('.');
      if (!errors[path]) {
        errors[path] = {
          type: issue.code,
          message: issue.message,
        };
      }
    }

    return { values: {} as Record<string, never>, errors };
  };
}
