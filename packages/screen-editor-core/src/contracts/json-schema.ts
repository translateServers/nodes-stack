import { z } from 'zod';
import {
  ScreenDocumentV1Schema,
  ScreenDocumentV2WireSchema,
  ScreenProjectDraftSchema,
  ScreenProjectDraftV2Schema,
  ScreenProjectEnvelopeInputSchema,
  ScreenProjectEnvelopeInputV2Schema,
  ScreenProjectExportV2Schema,
  ScreenProjectTransferV1Schema,
  ScreenProjectTransferV2Schema,
} from './document.js';

export const ScreenDocumentV1JsonSchema = z.toJSONSchema(ScreenDocumentV1Schema, {
  io: 'input',
});

export const ScreenProjectDraftJsonSchema = z.toJSONSchema(ScreenProjectDraftSchema, {
  io: 'input',
});

export const ScreenProjectEnvelopeInputJsonSchema = z.toJSONSchema(
  ScreenProjectEnvelopeInputSchema,
  { io: 'input' },
);

export const ScreenProjectTransferV1JsonSchema = z.toJSONSchema(ScreenProjectTransferV1Schema, {
  io: 'input',
});

// ===== V2 JSON Schemas（Spec §12.2 / §12.3 Task 5.1） =====

/**
 * V2 wire 文档 JSON Schema（Spec §12.2）。
 *
 * 仅描述 wire shape（容器 + 组件公共字段 + JSON 边界）。
 * 组件特定 schema 由注册表在运行时提供，无法静态生成。
 */
export const ScreenDocumentV2WireJsonSchema = z.toJSONSchema(ScreenDocumentV2WireSchema, {
  io: 'input',
});

export const ScreenProjectDraftV2JsonSchema = z.toJSONSchema(ScreenProjectDraftV2Schema, {
  io: 'input',
});

export const ScreenProjectEnvelopeInputV2JsonSchema = z.toJSONSchema(
  ScreenProjectEnvelopeInputV2Schema,
  { io: 'input' },
);

export const ScreenProjectTransferV2JsonSchema = z.toJSONSchema(ScreenProjectTransferV2Schema, {
  io: 'input',
});

export const ScreenProjectExportV2JsonSchema = z.toJSONSchema(ScreenProjectExportV2Schema, {
  io: 'input',
});
