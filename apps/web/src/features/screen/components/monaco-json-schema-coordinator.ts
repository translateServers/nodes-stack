import type { ComponentJsonSchema } from '@nebula/screen-editor-core';

export interface MonacoJsonSchemaRegistration {
  readonly fileMatch: readonly string[];
  readonly schema: ComponentJsonSchema;
  readonly uri: string;
}

export interface MonacoJsonSchemaCoordinator {
  register(registration: MonacoJsonSchemaRegistration): () => void;
}

export function createMonacoJsonSchemaCoordinator(
  apply: (registrations: readonly MonacoJsonSchemaRegistration[]) => void,
): MonacoJsonSchemaCoordinator {
  const registrations = new Map<string, MonacoJsonSchemaRegistration>();

  const refresh = (): void => {
    apply([...registrations.values()]);
  };

  return {
    register(registration) {
      registrations.set(registration.uri, registration);
      refresh();
      return () => {
        if (!registrations.delete(registration.uri)) return;
        refresh();
      };
    },
  };
}
