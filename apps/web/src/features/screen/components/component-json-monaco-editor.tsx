import MonacoEditor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/editor/editor.api';
import 'monaco-editor/editor/contrib/suggest/browser/suggestController';
import editorWorker from 'monaco-editor/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/language/json/json.worker?worker';
import { jsonDefaults } from 'monaco-editor/languages/features/json/register';
import { useCallback, useEffect } from 'react';
import type {
  ComponentJsonEditorDiagnostic,
  ComponentJsonEditorProps,
} from '@nebula/screen-editor-core';
import { createMonacoJsonSchemaCoordinator } from './monaco-json-schema-coordinator';
import { getComponentJsonPropertySuggestions } from './component-json-completions';

let configured = false;

function configureMonaco(): void {
  if (configured) return;
  globalThis.MonacoEnvironment = {
    ...globalThis.MonacoEnvironment,
    getWorker: (_workerId, label) => (label === 'json' ? new jsonWorker() : new editorWorker()),
  };
  loader.config({ monaco });
  configured = true;
}

const schemaCoordinator = createMonacoJsonSchemaCoordinator((registrations) => {
  jsonDefaults.setDiagnosticsOptions({
    allowComments: false,
    enableSchemaRequest: false,
    schemaRequest: 'ignore',
    schemaValidation: 'error',
    schemas: registrations.map((registration) => ({
      fileMatch: [...registration.fileMatch],
      schema: registration.schema,
      uri: registration.uri,
    })),
    validate: true,
  });
});

function toDiagnosticSeverity(marker: monaco.editor.IMarkerData): 'error' | 'info' | 'warning' {
  if (marker.severity === monaco.MarkerSeverity.Error) return 'error';
  if (marker.severity === monaco.MarkerSeverity.Warning) return 'warning';
  return 'info';
}

function toDiagnostics(markers: readonly monaco.editor.IMarker[]): ComponentJsonEditorDiagnostic[] {
  return markers.map((marker) => ({
    endColumn: marker.endColumn,
    endLineNumber: marker.endLineNumber,
    message: marker.message,
    severity: toDiagnosticSeverity(marker),
    startColumn: marker.startColumn,
    startLineNumber: marker.startLineNumber,
  }));
}

function getModelFileMatch(modelUri: string): string {
  const fileName = modelUri.split('/').at(-1);
  return fileName === undefined || fileName === '' ? modelUri : fileName;
}

configureMonaco();

export function ComponentJsonMonacoEditor({
  ariaLabel,
  jsonSchema,
  modelUri,
  onChange,
  onDiagnosticsChange,
  readOnly,
  theme,
  value,
}: ComponentJsonEditorProps) {
  useEffect(() => {
    return schemaCoordinator.register({
      fileMatch: [getModelFileMatch(modelUri)],
      schema: jsonSchema,
      uri: `${modelUri}.schema.json`,
    });
  }, [jsonSchema, modelUri]);

  useEffect(() => {
    const completionProvider = monaco.languages.registerCompletionItemProvider('json', {
      triggerCharacters: ['"', '{', ','],
      provideCompletionItems(model, position) {
        if (model.uri.toString() !== modelUri) return { suggestions: [] };
        const word = model.getWordUntilPosition(position);
        const range = {
          endColumn: word.endColumn,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          startLineNumber: position.lineNumber,
        };
        const suggestions = getComponentJsonPropertySuggestions(
          model.getValue(),
          model.getOffsetAt(position),
          jsonSchema,
        ).map((suggestion) => ({
          ...(suggestion.detail === undefined ? {} : { detail: suggestion.detail }),
          filterText: suggestion.label,
          insertText: suggestion.insertText,
          kind: monaco.languages.CompletionItemKind.Property,
          label: suggestion.label,
          range,
          sortText: suggestion.label,
        }));
        return { suggestions };
      },
    });
    return () => completionProvider.dispose();
  }, [jsonSchema, modelUri]);

  const handleChange = useCallback(
    (nextValue: string | undefined): void => {
      onChange(nextValue ?? '');
    },
    [onChange],
  );

  const handleValidate = useCallback(
    (markers: readonly monaco.editor.IMarker[]): void => {
      onDiagnosticsChange(toDiagnostics(markers));
    },
    [onDiagnosticsChange],
  );

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden rounded-md border border-border">
      <MonacoEditor
        height="100%"
        keepCurrentModel={false}
        language="json"
        loading={<div className="p-3 text-sm text-muted-foreground">正在加载编辑器</div>}
        onChange={handleChange}
        onValidate={handleValidate}
        options={{
          acceptSuggestionOnCommitCharacter: false,
          ariaLabel,
          automaticLayout: true,
          formatOnPaste: true,
          formatOnType: true,
          minimap: { enabled: false },
          quickSuggestions: false,
          readOnly,
          scrollBeyondLastLine: false,
          stickyScroll: { enabled: false },
          suggestOnTriggerCharacters: true,
          tabCompletion: 'on',
          tabSize: 2,
          wordBasedSuggestions: 'off',
          wordWrap: 'on',
        }}
        path={modelUri}
        theme={theme === 'dark' ? 'vs-dark' : 'light'}
        value={value}
        width="100%"
      />
    </div>
  );
}
