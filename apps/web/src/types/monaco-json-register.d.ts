declare module 'monaco-editor/languages/features/json/register' {
  export interface MonacoJsonSchemaRegistration {
    readonly fileMatch?: readonly string[];
    readonly schema?: unknown;
    readonly uri: string;
  }

  export interface MonacoJsonDiagnosticsOptions {
    readonly allowComments?: boolean;
    readonly enableSchemaRequest?: boolean;
    readonly schemaRequest?: 'error' | 'ignore' | 'warning';
    readonly schemaValidation?: 'error' | 'ignore' | 'warning';
    readonly schemas?: readonly MonacoJsonSchemaRegistration[];
    readonly validate?: boolean;
  }

  export interface MonacoJsonLanguageDefaults {
    setDiagnosticsOptions(options: MonacoJsonDiagnosticsOptions): void;
  }

  export const jsonDefaults: MonacoJsonLanguageDefaults;
}

declare module 'monaco-editor/editor/editor.api' {
  export * from 'monaco-editor';
}

declare module 'monaco-editor/editor/contrib/suggest/browser/suggestController' {}
