import { z } from 'zod';

import {
  ScreenDocumentInputSchema,
  ScreenDocumentWireSchema,
  ScreenProjectDraftSchema,
  ScreenProjectEnvelopeInputSchema,
  ScreenProjectExportSchema,
  ScreenProjectTransferSchema,
} from './document.js';

export const ScreenDocumentJsonSchema = z.toJSONSchema(ScreenDocumentWireSchema, { io: 'input' });
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
