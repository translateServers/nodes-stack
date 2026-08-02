import { describe, expect, it, vi } from 'vitest';
import { createMonacoJsonSchemaCoordinator } from './monaco-json-schema-coordinator';

describe('createMonacoJsonSchemaCoordinator', () => {
  it('keeps concurrent model schemas isolated and removes only the disposed registration', () => {
    const apply = vi.fn();
    const coordinator = createMonacoJsonSchemaCoordinator(apply);
    const disposeFirst = coordinator.register({
      fileMatch: ['inmemory://nebula-screen/a.json'],
      schema: { type: 'object' },
      uri: 'inmemory://nebula-screen/a.schema.json',
    });
    const disposeSecond = coordinator.register({
      fileMatch: ['inmemory://nebula-screen/b.json'],
      schema: { type: 'object' },
      uri: 'inmemory://nebula-screen/b.schema.json',
    });

    expect(apply).toHaveBeenLastCalledWith([
      {
        fileMatch: ['inmemory://nebula-screen/a.json'],
        schema: { type: 'object' },
        uri: 'inmemory://nebula-screen/a.schema.json',
      },
      {
        fileMatch: ['inmemory://nebula-screen/b.json'],
        schema: { type: 'object' },
        uri: 'inmemory://nebula-screen/b.schema.json',
      },
    ]);

    disposeFirst();
    expect(apply).toHaveBeenLastCalledWith([
      {
        fileMatch: ['inmemory://nebula-screen/b.json'],
        schema: { type: 'object' },
        uri: 'inmemory://nebula-screen/b.schema.json',
      },
    ]);

    disposeSecond();
    expect(apply).toHaveBeenLastCalledWith([]);
  });
});
