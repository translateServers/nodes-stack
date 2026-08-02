import type { ScreenProjectEnvelope } from '../contracts/document.js';
import { ScreenHostController, type PreparedScreenImport } from './screen-host-controller.js';

export interface ScreenImportControllerPort {
  readonly importProject: (prepared: PreparedScreenImport) => Promise<ScreenProjectEnvelope>;
  readonly prepareImport: (file: File) => Promise<PreparedScreenImport>;
}

export function createScreenImportControllerPort(
  controller: ScreenHostController,
): ScreenImportControllerPort {
  return {
    prepareImport: (file) => controller.prepareImport(file),
    importProject: (prepared) => controller.importProject(prepared),
  };
}
