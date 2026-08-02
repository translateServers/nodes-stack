/**
 * JSON 边界类型（Spec §7.1）
 *
 * 公共组件协议只接受可结构化克隆的 JSON 值。
 * 以下值非法：undefined、bigint、symbol、function、class instance、DOM Node、Promise、
 * 循环引用和不可结构化克隆对象。
 */

export type ScreenComponentJsonPrimitive = string | number | boolean | null;

export type ScreenComponentJsonValue =
  | ScreenComponentJsonPrimitive
  | ScreenComponentJsonValue[]
  | { [key: string]: ScreenComponentJsonValue };

export type ScreenComponentProps = Record<string, ScreenComponentJsonValue>;
