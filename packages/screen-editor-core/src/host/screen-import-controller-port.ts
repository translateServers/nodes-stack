import type { PreparedScreenImport, ScreenHostController } from './screen-host-controller.js';
import {
  ScreenHostControllerV2,
  type PreparedScreenImportV2,
} from './screen-host-controller-v2.js';
import type { ScreenProjectEnvelope, ScreenProjectEnvelopeV2 } from '../contracts/document.js';

export type ScreenPreparedImport = PreparedScreenImport | PreparedScreenImportV2;

export interface ScreenImportControllerPort {
  readonly mode: 'v1' | 'v2';
  importProject(
    prepared: ScreenPreparedImport,
  ): Promise<ScreenProjectEnvelope | ScreenProjectEnvelopeV2>;
  prepareImport(file: File): Promise<ScreenPreparedImport>;
}

export function createV1ScreenImportControllerPort(
  controller: ScreenHostController,
): ScreenImportControllerPort {
  return {
    mode: 'v1',
    prepareImport: async (file) => controller.prepareImport(file),
    importProject: async (prepared) => {
      if (prepared.kind !== 'v1') throw new Error('V1 import controller received a V2 transfer');
      return controller.importProject(prepared);
    },
  };
}

export function createV2ScreenImportControllerPort(
  controller: ScreenHostControllerV2,
): ScreenImportControllerPort {
  return {
    mode: 'v2',
    prepareImport: async (file) => controller.prepareImport(file),
    importProject: async (prepared) => {
      if (prepared.kind !== 'v2') throw new Error('V2 import controller received a V1 transfer');
      return controller.importProject(prepared);
    },
  };
}
