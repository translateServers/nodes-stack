import { z } from 'zod';
import {
  ScreenDocumentV1Schema,
  ScreenProjectDraftSchema,
  ScreenProjectEnvelopeInputSchema,
  ScreenProjectTransferV1Schema,
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
