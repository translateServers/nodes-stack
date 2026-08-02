import type { ComponentType, LazyExoticComponent } from 'react';
import type { ComponentJsonSchema } from '../lib/component-json-config.js';

export interface ComponentJsonEditorDiagnostic {
  readonly endColumn?: number;
  readonly endLineNumber?: number;
  readonly message: string;
  readonly path?: ReadonlyArray<string | number>;
  readonly severity: 'error' | 'info' | 'warning';
  readonly startColumn?: number;
  readonly startLineNumber?: number;
}

export interface ComponentJsonEditorProps {
  readonly ariaLabel: string;
  readonly jsonSchema: ComponentJsonSchema;
  readonly modelUri: string;
  readonly onChange: (value: string) => void;
  readonly onDiagnosticsChange: (diagnostics: readonly ComponentJsonEditorDiagnostic[]) => void;
  readonly readOnly: boolean;
  readonly theme: 'dark' | 'light';
  readonly value: string;
}

export type ComponentJsonEditorComponent =
  | ComponentType<ComponentJsonEditorProps>
  | LazyExoticComponent<ComponentType<ComponentJsonEditorProps>>;
