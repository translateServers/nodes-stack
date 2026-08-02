/**
 * 组件集中注册入口（Spec 驱动改造：组件库统一注册接口）
 *
 * 副作用模块：导入即初始化 registry 派生 lookup 与 property schema。
 *
 * 调用方约定：任何依赖注册表派生表（COMPONENT_DEFINITIONS / RENDERERS / ICON_MAP /
 * PROPERTY_SCHEMAS）的模块，需在模块顶部 `import './registered-components'`
 * （或 import 包含此副作用入口的 re-export 模块，如 `registry/index.ts`）以确保注册完成。
 *
 * 此模块在所有组件注册完成后：
 * 1. 调用 __registerDefinitionLookup(getDefinitionByType) 打破循环依赖，
 *    使 component-events-actions.ts 的 getComponentEvents/getComponentActions
 *    在运行时能查到 definition。
 * 2. 调用 buildPropertySchemas() 把各组件的 schema 从注册中心派生到 PROPERTY_SCHEMAS，
 *    避免 schemas.tsx 直接 import 本文件形成循环依赖
 *    （schemas.tsx 被组件模块导入，循环时 TEXT_SCHEMA 等尚未定义）。
 */

import { __registerDefinitionLookup } from './component-events-actions';
import { getDefinitionByType } from './registry';
import { buildPropertySchemas } from '../property-schema/schemas';
import { BUILTIN_COMPONENT_MODULES } from './builtin-modules';

// 注入 getDefinitionByType 打破循环依赖：
// component-events-actions.ts 的 getComponentEvents/getComponentActions
// 在运行时调用 getDefinitionByType(type) 读取已注册 definition。
__registerDefinitionLookup(getDefinitionByType);

// 从注册中心派生 PROPERTY_SCHEMAS：
// 在所有组件注册完成后调用，把 ComponentModule.schema 字段写入 PROPERTY_SCHEMAS。
// schemas.tsx 不能直接 import 本文件（会形成循环依赖），故由本文件主动调用。
buildPropertySchemas(BUILTIN_COMPONENT_MODULES);
