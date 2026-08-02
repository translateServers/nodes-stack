import {
  ScreenAdapterErrorCode,
  ScreenExportFileSchema,
  ScreenSnapshotSummarySchema,
  assertScreenHostAdapter,
  deriveScreenHostCapabilities,
  normalizeScreenAdapterError,
  toScreenPublicError,
  type ScreenHostAdapter,
} from './index.js';

function createAdapter(): ScreenHostAdapter {
  return {
    loadProject: () => Promise.reject(new Error('not used')),
    saveProject: () => Promise.reject(new Error('not used')),
  };
}

describe('screen host adapter contract', () => {
  it('rejects adapters missing required methods', () => {
    expect(() => assertScreenHostAdapter({ loadProject: () => Promise.resolve() })).toThrow();
  });

  it('derives optional capabilities from method presence', () => {
    const adapter = createAdapter();
    adapter.publishProject = () => Promise.reject(new Error('not used'));
    adapter.snapshots = {
      list: () => Promise.resolve([]),
      create: () => Promise.reject(new Error('not used')),
      restore: () => Promise.reject(new Error('not used')),
      remove: () => Promise.resolve(),
      clear: () => Promise.resolve(),
    };

    expect(deriveScreenHostCapabilities(adapter)).toEqual({
      load: true,
      save: true,
      publish: true,
      import: false,
      export: false,
      snapshots: true,
    });
  });

  it('rejects incomplete optional capability groups', () => {
    const adapter = {
      ...createAdapter(),
      snapshots: { list: () => Promise.resolve([]) },
    };

    expect(() => deriveScreenHostCapabilities(adapter)).toThrow('Snapshot Adapter 能力组不完整');
  });

  it('maps hostile adapter errors to safe public messages', () => {
    const publicError = toScreenPublicError({
      message: 'Bearer secret-token; cookie=session-secret',
      code: 'CONFLICT',
      recoverable: true,
      serverRevision: 'revision-2',
      response: { authorization: 'secret-token' },
      stack: 'sensitive stack',
      cause: 'sensitive cause',
      custom: 'sensitive custom value',
    });

    expect(publicError).toEqual({
      code: ScreenAdapterErrorCode.CONFLICT,
      message: '项目已被其他操作更新，请重新加载后重试。',
      recoverable: true,
      serverRevision: 'revision-2',
      diagnostics: undefined,
    });
    expect(JSON.stringify(publicError)).not.toContain('secret');
  });

  it('sanitizes hostile diagnostic messages and path segments', () => {
    const publicError = toScreenPublicError({
      message: 'validation failed',
      code: 'VALIDATION',
      diagnostics: [
        {
          code: 'INVALID_DOCUMENT',
          path: ['components', 'secret-token-value'],
          severity: 'error',
          message: 'cookie=session-secret',
        },
      ],
    });

    expect(publicError.diagnostics).toEqual([
      {
        code: 'INVALID_DOCUMENT',
        path: ['components', '<field>'],
        severity: 'error',
        message: '文档字段校验失败。',
      },
    ]);
    expect(JSON.stringify(publicError)).not.toContain('secret');
  });

  it('normalizes AbortSignal cancellation without exposing it as a generic failure', () => {
    const controller = new AbortController();
    controller.abort();

    expect(normalizeScreenAdapterError(new Error('late response'), controller.signal).code).toBe(
      ScreenAdapterErrorCode.ABORTED,
    );
  });
});

describe('adapter response schemas', () => {
  const validSnapshot = {
    id: 'snapshot-1',
    name: 'Before release',
    createdAt: '2026-07-30T10:00:00Z',
    componentCount: 1,
    canvasWidth: 1920,
    canvasHeight: 1080,
  };

  it('requires timezone-aware snapshot timestamps', () => {
    expect(
      ScreenSnapshotSummarySchema.safeParse({
        ...validSnapshot,
        createdAt: '2026-07-30T10:00:00',
      }).success,
    ).toBe(false);
  });

  it.each([
    ['componentCount', -1],
    ['canvasWidth', 0],
    ['canvasHeight', -1],
  ])('rejects invalid snapshot %s', (field, value) => {
    expect(
      ScreenSnapshotSummarySchema.safeParse({ ...validSnapshot, [field]: value }).success,
    ).toBe(false);
  });

  it('accepts JSON blobs with a safe basename', () => {
    expect(
      ScreenExportFileSchema.safeParse({
        fileName: 'screen-export.json',
        blob: new Blob(['{}'], { type: 'application/json; charset=utf-8' }),
      }).success,
    ).toBe(true);
  });

  it.each([
    '../screen.json',
    'folder/screen.json',
    'screen..json',
    'screen.txt',
  ])('rejects unsafe export filename %s', (fileName) => {
    expect(
      ScreenExportFileSchema.safeParse({
        fileName,
        blob: new Blob(['{}'], { type: 'application/json' }),
      }).success,
    ).toBe(false);
  });

  it('rejects non-JSON blob MIME types', () => {
    expect(
      ScreenExportFileSchema.safeParse({
        fileName: 'screen.json',
        blob: new Blob(['{}'], { type: 'text/plain' }),
      }).success,
    ).toBe(false);
  });

  it('enforces the complete 255-character filename limit', () => {
    const validFileName = `${'a'.repeat(250)}.json`;
    const invalidFileName = `${'a'.repeat(251)}.json`;
    const blob = new Blob(['{}'], { type: 'application/json' });

    expect(ScreenExportFileSchema.safeParse({ fileName: validFileName, blob }).success).toBe(true);
    expect(ScreenExportFileSchema.safeParse({ fileName: invalidFileName, blob }).success).toBe(
      false,
    );
  });

  it.each([
    'folder\\screen.json',
    'screen\u0000.json',
  ])('rejects export filename %s', (fileName) => {
    expect(
      ScreenExportFileSchema.safeParse({
        fileName,
        blob: new Blob(['{}'], { type: 'application/json' }),
      }).success,
    ).toBe(false);
  });
});
