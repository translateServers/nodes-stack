import { z } from 'zod';
import { ScreenDocumentJsonSchema as SharedScreenDocumentJsonSchema } from '@nebula/shared';

import {
  ScreenDocumentInputSchema,
  ScreenDocumentWireSchema,
  ScreenProjectDraftSchema,
  ScreenProjectEnvelopeInputSchema,
  ScreenProjectExportSchema,
  ScreenProjectTransferSchema,
} from './document.js';

export const ScreenDocumentJsonSchema = SharedScreenDocumentJsonSchema;
export const ScreenDocumentInputJsonSchema = z.toJSONSchema(ScreenDocumentInputSchema, {
  io: 'input',
});
export const ScreenProjectDraftJsonSchema = z.toJSONSchema(ScreenProjectDraftSchema, {
  io: 'input',
});
export const ScreenProjectEnvelopeInputJsonSchema = z.toJSONSchema(
  ScreenProjectEnvelopeInputSchema,
  {
    io: 'input',
  },
);
export const ScreenProjectTransferJsonSchema = z.toJSONSchema(ScreenProjectTransferSchema, {
  io: 'input',
});
export const ScreenProjectExportJsonSchema = z.toJSONSchema(ScreenProjectExportSchema, {
  io: 'input',
});
