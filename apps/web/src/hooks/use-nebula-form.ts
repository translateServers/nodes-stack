import { useForm, type UseFormProps, type Resolver } from 'react-hook-form';
import type { z } from 'zod';
import { zodResolver } from '@/lib/zod-resolver';

/**
 * 创建带 Zod 校验的表单，自动推导类型。
 *
 * @example
 * const form = useNebulaForm({
 *   schema: CreateUserSchema,
 *   defaultValues: { username: '', email: '', password: '' },
 * });
 *
 * form.handleSubmit((data) => { ... }) // data 类型为 z.infer<typeof CreateUserSchema>
 */
export function useNebulaForm<TSchema extends z.ZodObject<z.ZodRawShape>>({
  schema,
  ...config
}: {
  schema: TSchema;
} & UseFormProps<z.infer<TSchema>>) {
  // TODO: react-hook-form 的 Resolver 类型与 Zod 4 不兼容，待官方支持后移除断言
  // https://github.com/react-hook-form/react-hook-form/issues/12000
  const resolver = zodResolver(schema) as Resolver<z.infer<TSchema>>;

  return useForm<z.infer<TSchema>>({
    ...config,
    resolver,
  });
}
