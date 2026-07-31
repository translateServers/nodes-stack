import { ScreenExportFileSchema, type ScreenExportFile } from '../contracts/adapter.js';

export function downloadScreenExportFile(
  file: ScreenExportFile,
  ownerDocument: Document = document,
): void {
  const validated = ScreenExportFileSchema.parse(file);
  const objectUrl = URL.createObjectURL(validated.blob);
  const link = ownerDocument.createElement('a');
  try {
    link.href = objectUrl;
    link.download = validated.fileName;
    link.hidden = true;
    ownerDocument.body.append(link);
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }
}
