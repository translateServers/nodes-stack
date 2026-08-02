/**
 * 蓝图模板模块入口（任务 9.3）
 *
 * 公开 API：
 * - `BLUEPRINT_TEMPLATES`：模板元数据列表
 * - `getTemplateMeta`：模板 ID → 元数据查找
 * - `createTemplateBlueprint`：构造模板蓝图（无校验）
 * - `buildValidatedTemplate`：构造 + Schema 校验（推荐入口）
 * - `TemplateGallery`：模板卡片画廊组件
 * - `EmptyBlueprintState`：空蓝图引导态组件
 * - 类型：`BlueprintTemplateId` / `BlueprintTemplateMeta` / `TemplateBuildResult` 等
 */

export {
  BLUEPRINT_TEMPLATES,
  getTemplateMeta,
} from './template-definitions';
export type {
  BlueprintTemplateId,
  BlueprintTemplateMeta,
} from './template-definitions';

export { createTemplateBlueprint } from './create-template-blueprint';

export { buildValidatedTemplate } from './build-validated-template';
export type {
  TemplateBuildFailure,
  TemplateBuildResult,
  TemplateBuildSuccess,
} from './build-validated-template';

export { TemplateGallery } from './template-gallery';
export type { TemplateGalleryProps } from './template-gallery';

export { EmptyBlueprintState } from './empty-blueprint-state';
export type { EmptyBlueprintStateProps } from './empty-blueprint-state';
