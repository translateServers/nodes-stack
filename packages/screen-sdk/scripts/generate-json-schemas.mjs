import { mkdir, writeFile } from 'node:fs/promises';
import {
  ScreenDocumentV1JsonSchema,
  ScreenProjectDraftJsonSchema,
  ScreenProjectEnvelopeInputJsonSchema,
  ScreenProjectTransferV1JsonSchema,
} from '../dist/contracts/index.js';

const outputDirectory = new URL('../dist/contracts/', import.meta.url);
/** @type {Array<{ fileName: string; schema: unknown }>} */
const schemas = [
  { fileName: 'screen-document.schema.json', schema: ScreenDocumentV1JsonSchema },
  { fileName: 'screen-project-draft.schema.json', schema: ScreenProjectDraftJsonSchema },
  {
    fileName: 'screen-project-envelope-input.schema.json',
    schema: ScreenProjectEnvelopeInputJsonSchema,
  },
  { fileName: 'screen-project-transfer.schema.json', schema: ScreenProjectTransferV1JsonSchema },
];

await mkdir(outputDirectory, { recursive: true });
await Promise.all(
  schemas.map(({ fileName, schema }) =>
    writeFile(new URL(fileName, outputDirectory), `${JSON.stringify(schema, null, 2)}\n`, 'utf8'),
  ),
);
