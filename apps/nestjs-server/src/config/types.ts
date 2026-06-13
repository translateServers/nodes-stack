// src/config/types.ts

// 1. 定义基础类型（遇到这些类型就不再往下递归路径了）
type Primitive = string | number | boolean | null | undefined | Date;

// 2. 递归提取所有合法的路径 (限制最大深度为 3 层，防止 TS 性能问题)
export type ConfigPath<T, Depth extends number[] = []> = Depth['length'] extends 3
  ? never
  : T extends Primitive
    ? never
    : T extends Array<unknown>
      ? never // 配置中通常不直接通过路径访问数组元素，这里简化处理
      : {
          [K in keyof T & string]: T[K] extends Primitive
            ? K
            : K | `${K}.${ConfigPath<T[K], [...Depth, 1]>}`;
        }[keyof T & string];

// 3. 根据路径推导值类型
export type ConfigPathValue<T, P extends ConfigPath<T>> = P extends `${infer Key}.${infer Rest}`
  ? Key extends keyof T
    ? Rest extends ConfigPath<T[Key]>
      ? ConfigPathValue<T[Key], Rest>
      : never
    : never
  : P extends keyof T
    ? T[P]
    : never;
