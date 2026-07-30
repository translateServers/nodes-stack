import {
  SCREEN_TRANSFER_MAX_BYTES,
  ScreenDocumentV1JsonSchema,
  ScreenDocumentV1Schema,
  ScreenProjectDraftJsonSchema,
  ScreenProjectEnvelopeInputJsonSchema,
  ScreenProjectTransferV1Schema,
  ScreenSdkDiagnosticCode,
  cloneScreenProjectDraft,
  cloneScreenProjectTransfer,
  parseScreenDocument,
  parseScreenProjectEnvelopeInput,
  validateScreenSdkCapabilities,
  type ScreenDocumentV1,
  type ScreenProjectTransferV1,
} from './index.js';

function createDocument(): ScreenDocumentV1 {
  return ScreenDocumentV1Schema.parse({
    schemaVersion: 1,
    canvas: {
      width: 1920,
      height: 1080,
      backgroundColor: '#000000',
      scaleMode: 'fit',
    },
    components: [
      {
        id: 'text-1',
        type: 'text',
        name: 'Text',
        position: { x: 0, y: 0, width: 200, height: 80 },
        style: {},
        props: { content: 'Hello' },
        status: { locked: false, hidden: false },
        zIndex: 1,
      },
    ],
    globalVariables: [],
  });
}

describe('screen document contract', () => {
  it('accepts the six strict component branches and rejects unknown props', () => {
    const document = createDocument();
    const input = structuredClone(document) as Record<string, unknown>;
    const components = input.components as Array<Record<string, unknown>>;
    components[0] = { ...components[0], props: { content: 'Hello', secret: true } };

    const result = parseScreenDocument(input);

    expect(result).toMatchObject({
      success: false,
      code: 'UNSUPPORTED_DOCUMENT_FEATURE',
      diagnostics: [
        {
          code: ScreenSdkDiagnosticCode.INVALID_COMPONENT_PROPS,
          path: ['components', 0, 'props', 'secret'],
        },
      ],
    });
  });

  it('accepts all six declared component props branches', () => {
    const input = structuredClone(createDocument()) as Record<string, unknown>;
    const base = (input.components as Array<Record<string, unknown>>)[0];
    input.components = [
      { ...base, id: 'text-1', type: 'text', props: { content: 'Text' } },
      {
        ...base,
        id: 'chart-1',
        type: 'bar-chart',
        props: { title: 'Chart', data: [{ name: 'A', value: 1 }] },
      },
      { ...base, id: 'rect-1', type: 'rect', props: {} },
      { ...base, id: 'ellipse-1', type: 'ellipse', props: {} },
      {
        ...base,
        id: 'image-1',
        type: 'image',
        props: { src: 'https://example.com/image.png', alt: 'Image' },
      },
      { ...base, id: 'button-1', type: 'button', props: { text: 'Submit' } },
    ];

    expect(parseScreenDocument(input).success).toBe(true);
  });

  it('rejects unknown component types without partially loading the document', () => {
    const input = structuredClone(createDocument()) as Record<string, unknown>;
    const components = input.components as Array<Record<string, unknown>>;
    components[0] = { ...components[0], type: 'plugin-widget' };

    expect(parseScreenDocument(input)).toMatchObject({
      success: false,
      code: 'UNSUPPORTED_DOCUMENT_FEATURE',
      diagnostics: [{ code: ScreenSdkDiagnosticCode.UNKNOWN_COMPONENT_TYPE }],
    });
  });

  it.each([
    ['api', { type: 'api', apiConfig: { authorization: 'secret' } }],
    ['dataset', { type: 'dataset', datasetId: 'dataset-1' }],
  ])('rejects %s data sources with a stable path', (_name, dataSource) => {
    const input = structuredClone(createDocument()) as Record<string, unknown>;
    const components = input.components as Array<Record<string, unknown>>;
    components[0] = { ...components[0], dataSource };

    const diagnostics = validateScreenSdkCapabilities(input);

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: ScreenSdkDiagnosticCode.UNSUPPORTED_DATA_SOURCE,
        path: ['components', 0, 'dataSource'],
      }),
    );
    expect(JSON.stringify(diagnostics)).not.toContain('secret');
  });

  it('rejects API global variables', () => {
    const input = structuredClone(createDocument()) as Record<string, unknown>;
    input.globalVariables = [
      {
        id: 'global-1',
        name: 'token',
        type: 'api',
        apiConfig: { headers: { authorization: 'secret' } },
      },
    ];

    expect(validateScreenSdkCapabilities(input)).toContainEqual(
      expect.objectContaining({
        code: ScreenSdkDiagnosticCode.UNSUPPORTED_GLOBAL_VARIABLE_TYPE,
        path: ['globalVariables', 0, 'type'],
      }),
    );
  });

  it('rejects requestApi nodes and refreshData actions', () => {
    const input = structuredClone(createDocument()) as Record<string, unknown>;
    input.blueprint = {
      version: 2,
      nodes: [
        {
          id: 'request-1',
          kind: 'component',
          componentId: 'global',
          globalType: 'requestApi',
          position: { x: 0, y: 0 },
          config: {
            globalType: 'requestApi',
            method: 'GET',
            url: 'https://example.com',
            headers: { authorization: 'secret' },
            body: '',
            secretHeaderKeys: ['authorization'],
            timeoutMs: 10000,
          },
        },
        {
          id: 'component-1',
          kind: 'component',
          componentId: 'text-1',
          position: { x: 100, y: 0 },
        },
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'component-1',
          sourceHandle: 'evt:click',
          target: 'component-1',
          targetHandle: 'act:refreshData',
        },
      ],
    };

    const diagnostics = validateScreenSdkCapabilities(input);

    expect(diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        ScreenSdkDiagnosticCode.UNSUPPORTED_BLUEPRINT_NODE,
        ScreenSdkDiagnosticCode.UNSUPPORTED_BLUEPRINT_ACTION,
      ]),
    );
    expect(JSON.stringify(diagnostics)).not.toContain('secret');
  });

  it('reports future blueprint node kinds as unsupported capabilities', () => {
    const input = structuredClone(createDocument()) as Record<string, unknown>;
    input.blueprint = {
      version: 2,
      nodes: [
        {
          id: 'future-1',
          kind: 'script',
          position: { x: 0, y: 0 },
          config: { source: 'not exposed' },
        },
      ],
      edges: [],
    };

    expect(parseScreenDocument(input)).toMatchObject({
      success: false,
      code: 'UNSUPPORTED_DOCUMENT_FEATURE',
      diagnostics: [
        {
          code: ScreenSdkDiagnosticCode.UNSUPPORTED_BLUEPRINT_NODE,
          path: ['blueprint', 'nodes', 0, 'kind'],
        },
      ],
    });
  });

  it('rejects V1 migration warnings instead of dropping graph edges', () => {
    const input = structuredClone(createDocument()) as Record<string, unknown>;
    input.blueprint = {
      version: 1,
      nodes: [],
      edges: [
        {
          id: 'dangling-edge',
          source: 'missing-source',
          sourceHandle: 'out',
          target: 'missing-target',
          targetHandle: 'in',
        },
      ],
    };

    expect(parseScreenDocument(input)).toMatchObject({
      success: false,
      code: 'UNSUPPORTED_DOCUMENT_FEATURE',
      diagnostics: [
        {
          code: ScreenSdkDiagnosticCode.DANGLING_COMPONENT_REFERENCE,
          path: ['blueprint', 'edges', 0],
        },
      ],
    });
  });

  it('normalizes V1 scrollToComponent actions to a global V2 scrollTo node', () => {
    const input = structuredClone(createDocument()) as Record<string, unknown>;
    input.blueprint = {
      version: 1,
      nodes: [
        {
          id: 'page-load',
          kind: 'trigger',
          position: { x: 0, y: 0 },
          config: { type: 'pageLoad' },
        },
        {
          id: 'scroll',
          kind: 'action',
          position: { x: 100, y: 0 },
          config: { type: 'scrollToComponent', targetComponentId: 'text-1' },
        },
      ],
      edges: [
        {
          id: 'scroll-edge',
          source: 'page-load',
          sourceHandle: 'out',
          target: 'scroll',
          targetHandle: 'in',
        },
      ],
    };

    const result = parseScreenDocument(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.blueprint?.nodes).toContainEqual(
        expect.objectContaining({
          kind: 'component',
          componentId: 'global',
          globalType: 'scrollTo',
          config: { globalType: 'scrollTo', targetComponentId: 'text-1' },
        }),
      );
      expect(result.data.blueprint?.edges[0]?.targetHandle).toBe('act:scrollTo');
    }
  });

  it('rejects non-persistable image protocols', () => {
    const input = structuredClone(createDocument()) as Record<string, unknown>;
    const components = input.components as Array<Record<string, unknown>>;
    components[0] = {
      ...components[0],
      type: 'image',
      props: { src: 'blob:https://example.com/temporary' },
    };

    expect(parseScreenDocument(input)).toMatchObject({
      success: false,
      code: 'VALIDATION',
      diagnostics: [{ path: ['components', 0, 'props', 'src'] }],
    });
  });

  it.each(['https://', 'data:'])('rejects malformed image URL %s', (src) => {
    const input = structuredClone(createDocument()) as Record<string, unknown>;
    const components = input.components as Array<Record<string, unknown>>;
    components[0] = { ...components[0], type: 'image', props: { src } };

    expect(parseScreenDocument(input).success).toBe(false);
  });

  it('migrates a supported V1 blueprint to canonical V2', () => {
    const input = structuredClone(createDocument()) as Record<string, unknown>;
    input.blueprint = {
      version: 1,
      nodes: [
        {
          id: 'trigger-1',
          kind: 'trigger',
          position: { x: 0, y: 0 },
          config: { type: 'componentClick', componentId: 'text-1' },
        },
        {
          id: 'action-1',
          kind: 'action',
          position: { x: 100, y: 0 },
          config: { type: 'setVisibility', targetComponentId: 'text-1', visible: 'hide' },
        },
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'trigger-1',
          sourceHandle: 'out',
          target: 'action-1',
          targetHandle: 'in',
        },
      ],
    };

    const result = parseScreenDocument(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.blueprint?.version).toBe(2);
      expect(result.data.blueprint?.edges[0]).toMatchObject({
        sourceHandle: 'evt:click',
        targetHandle: 'act:hide',
      });
    }
  });

  it('distinguishes future schema versions from ordinary validation failures', () => {
    const input = { ...createDocument(), schemaVersion: 2 };

    expect(parseScreenDocument(input)).toMatchObject({
      success: false,
      code: 'UNSUPPORTED_DOCUMENT_FEATURE',
      diagnostics: [{ code: ScreenSdkDiagnosticCode.UNSUPPORTED_SCHEMA_VERSION }],
    });
  });

  it('validates the expected project id and trims project names', () => {
    const result = parseScreenProjectEnvelopeInput(
      {
        id: 'project-2',
        name: '  Example  ',
        status: 'draft',
        revision: 'opaque-revision',
        document: createDocument(),
      },
      'project-1',
    );

    expect(result).toMatchObject({
      success: false,
      code: 'VALIDATION',
      diagnostics: [{ path: ['id'] }],
    });
  });

  it('normalizes valid project names and rejects blank names', () => {
    const baseEnvelope = {
      id: 'project-1',
      name: '  Example  ',
      status: 'draft',
      revision: 'opaque-revision',
      document: createDocument(),
    };
    const result = parseScreenProjectEnvelopeInput(baseEnvelope, 'project-1');

    expect(result).toMatchObject({ success: true, data: { name: 'Example' } });
    expect(parseScreenProjectEnvelopeInput({ ...baseEnvelope, name: '   ' }).success).toBe(false);
  });

  it('enforces transfer format and exposes the 10 MiB limit', () => {
    expect(SCREEN_TRANSFER_MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(
      ScreenProjectTransferV1Schema.safeParse({
        format: 'other-format',
        formatVersion: 1,
        name: 'Example',
        document: createDocument(),
      }).success,
    ).toBe(false);
  });

  it('returns detached transfer snapshots', () => {
    const transfer: ScreenProjectTransferV1 = {
      format: 'nebula-screen',
      formatVersion: 1,
      name: 'Example',
      document: createDocument(),
    };
    const clone = cloneScreenProjectTransfer(transfer);
    const component = clone.document.components[0];
    if (component?.type === 'text') component.props.content = 'Changed';

    const original = transfer.document.components[0];
    expect(original?.type === 'text' ? original.props.content : undefined).toBe('Hello');
  });

  it('returns detached draft snapshots including nested static values', () => {
    const document = createDocument();
    document.globalVariables = [
      { id: 'global-1', name: 'settings', type: 'static', value: { enabled: true } },
    ];
    const draft = { name: 'Example', document };
    const clone = cloneScreenProjectDraft(draft);
    const value = clone.document.globalVariables[0]?.value as Record<string, unknown>;
    value.enabled = false;

    expect((draft.document.globalVariables[0]?.value as Record<string, unknown>).enabled).toBe(
      true,
    );
  });

  it('keeps JSON Schema constraints aligned with runtime nonblank and URL rules', () => {
    const schemas = JSON.stringify({
      document: ScreenDocumentV1JsonSchema,
      draft: ScreenProjectDraftJsonSchema,
      envelope: ScreenProjectEnvelopeInputJsonSchema,
    });

    expect(schemas).toContain('^https?');
    expect(schemas).toContain('^data:');
    expect(schemas).toContain('\\S');
  });
});
