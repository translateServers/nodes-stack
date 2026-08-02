import { createContext, useContext } from 'react';

import type { BlueprintDiagnostic } from '../compiler/types.js';

export interface BaseDiagnostic {
  readonly level: 'error' | 'warning' | 'info';
  readonly code: string;
  readonly message: string;
  readonly nodeId?: string;
  readonly edgeId?: string;
}

export type DiagnosticMap = Map<string, BaseDiagnostic[]>;

const BlueprintDiagnosticMapContext = createContext<DiagnosticMap>(new Map());

export const BlueprintDiagnosticMapProvider = BlueprintDiagnosticMapContext.Provider;

export function useBlueprintDiagnosticMap(): DiagnosticMap {
  return useContext(BlueprintDiagnosticMapContext);
}

export function buildDiagnosticMap(diagnostics: readonly BlueprintDiagnostic[]): DiagnosticMap {
  const result: DiagnosticMap = new Map();
  for (const diagnostic of diagnostics) {
    if (diagnostic.nodeId === undefined) {
      continue;
    }
    const current = result.get(diagnostic.nodeId) ?? [];
    current.push(diagnostic);
    result.set(diagnostic.nodeId, current);
  }
  return result;
}
