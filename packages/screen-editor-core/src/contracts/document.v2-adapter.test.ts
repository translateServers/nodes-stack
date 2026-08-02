/**
 * V2 Adapter/Transfer/Snapshot tests（Spec §12.3 + Requirement 8 + Requirement 12, Task 5.5）
 *
 * 仅测试 V2 业务约束（不测 Zod 框架自身能力）：
 * - parseScreenProjectEnvelopeInputV2: V2 envelope load/save/publish/restore 校验
 * - parseScreenProjectDraftV2: V2 draft 校验（save/snapshot create input）
 * - parseScreenProjectTransferV2: V2 transfer 校验（import）
 * - parseScreenProjectExportV2: 结构化 fileName + TransferV2 校验（export）
 * - cloneScreenProjectDraftV2 / cloneScreenProjectTransferV2: detached snapshot
 * - 指标卡（外部组件）load → save → reload → import → export → snapshot restore round-trip
 * - 文档含 tagName/moduleUrl/script 字段被拒绝（Requirement 12）
 * - 不安全 fileName（路径段/..../控制字符/非 .json）被拒绝
 * - V1 transfer 不得嵌入 V2 document；V2 transfer 不得嵌入 V1 document
 */

import { describe, expect, it } from 'vitest';
import type { ScreenComponentManifestV1 } from '@nebula/screen-component-sdk';
import {
  cloneScreenProjectDraftV2,
  cloneScreenProjectTransferV2,
  parseScreenDocumentV2,
  parseScreenProjectDraftV2,
  parseScreenProjectEnvelopeInputV2,
  parseScreenProjectExportV2,
  parseScreenProjectTransferV2,
  ScreenProjectTransferV1Schema,
  type ScreenDocumentV2,
  type ScreenProjectEnvelopeInputV2,
  type ScreenProjectTransferV2,
} from './document.js';
import {
  buildInstanceRegistry,
  type ScreenComponentInstanceRegistry,
  type ScreenComponentRegistration,
} from '../registry/instance-registry.js';

// ===== Test helpers =====

function createBuiltinManifest(type: string): ScreenComponentManifestV1 {
  return {
    apiVersion: 'nebula.screen-component/v1',
    type,
    implementationVersion: '1.0.0',
    tagName: `nebula-screen-${type.replace(/-/g, '')}-v1`,
    name: type,
    category: 'decoration',
    icon: 'text',
    defaultSize: { width: 200, height: 80 },
    defaultProps: {},
    propsSchema: { type: 'object', properties: {}, additionalProperties: false },
    events: [
      { id: 'click', name: '点击' },
      { id: 'hover', name: '悬停' },
    ],
  };
}

function createTextManifest(): ScreenComponentManifestV1 {
  return {
    ...createBuiltinManifest('text'),
    defaultProps: { content: '' },
    propsSchema: {
      type: 'object',
      properties: { content: { type: 'string' } },
      additionalProperties: false,
    },
  };
}

function createKpiCardManifest(): ScreenComponentManifestV1 {
  return {
    apiVersion: 'nebula.screen-component/v1',
    type: 'acme.kpi/v1',
    implementationVersion: '1.2.0',
    tagName: 'acme-kpi-card',
    name: 'KPI Card',
    category: 'chart',
    icon: 'chart',
    defaultSize: { width: 320, height: 180 },
    defaultProps: { title: '', value: 0, unit: '' },
    propsSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        value: { type: 'number' },
        unit: { type: 'string' },
      },
      required: ['title', 'value'],
      additionalProperties: false,
    },
    events: [{ id: 'click', name: '点击' }],
  };
}

function buildRegistryWithKpi(): ScreenComponentInstanceRegistry {
  const registrations: ScreenComponentRegistration[] = [
    { source: 'built-in', manifest: createTextManifest() },
    { source: 'built-in', manifest: createBuiltinManifest('rect') },
    {
      source: 'host',
      manifest: createKpiCardManifest(),
      elementConstructor: class TestKpiElement extends HTMLElement {},
    },
  ];
  return buildInstanceRegistry(registrations);
}

function createV2DocumentWithKpi(): ScreenDocumentV2 {
  return {
    schemaVersion: 2,
    canvas: {
      width: 1920,
      height: 1080,
      backgroundColor: '#0f172a',
      scaleMode: 'fit',
      backgroundImage: '',
    },
    components: [
      {
        id: 'kpi-1',
        type: 'acme.kpi/v1',
        name: 'Revenue KPI',
        position: { x: 40, y: 40, width: 320, height: 180 },
        style: { opacity: 1 },
        props: { title: 'Revenue', value: 1_280_500, unit: 'USD' },
        status: { locked: false, hidden: false },
        zIndex: 1,
      },
      {
        id: 'text-1',
        type: 'text',
        name: 'Header',
        position: { x: 10, y: 10, width: 200, height: 40 },
        style: {},
        props: { content: 'Dashboard' },
        status: { locked: false, hidden: false },
        zIndex: 2,
      },
    ],
    globalVariables: [],
  };
}

function createV2EnvelopeInput(): ScreenProjectEnvelopeInputV2 {
  return {
    id: 'proj-kpi-1',
    name: 'KPI Dashboard',
    description: 'External KPI card project',
    status: 'draft',
    revision: 'rev-1',
    document: createV2DocumentWithKpi(),
  };
}

function createV2Transfer(): ScreenProjectTransferV2 {
  return {
    format: 'nebula-screen',
    formatVersion: 2,
    name: 'KPI Dashboard',
    description: 'External KPI card project',
    document: createV2DocumentWithKpi(),
  };
}

// ===== Tests =====

describe('parseScreenProjectEnvelopeInputV2 — V2 envelope parser (Spec §12.3 + Requirement 8)', () => {
  it('parses a valid V2 envelope with external component', () => {
    const input = createV2EnvelopeInput();
    const registry = buildRegistryWithKpi();

    const result = parseScreenProjectEnvelopeInputV2(input, registry);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('proj-kpi-1');
      expect(result.data.name).toBe('KPI Dashboard');
      expect(result.data.status).toBe('draft');
      expect(result.data.revision).toBe('rev-1');
      expect(result.data.document.schemaVersion).toBe(2);
      expect(result.data.document.components).toHaveLength(2);
    }
  });

  it('preserves external component props through envelope parse', () => {
    const input = createV2EnvelopeInput();
    const registry = buildRegistryWithKpi();

    const result = parseScreenProjectEnvelopeInputV2(input, registry);

    expect(result.success).toBe(true);
    if (result.success) {
      const kpi = result.data.document.components[0];
      expect(kpi?.type).toBe('acme.kpi/v1');
      expect(kpi?.props).toEqual({ title: 'Revenue', value: 1_280_500, unit: 'USD' });
    }
  });

  it('rejects envelope with mismatching expectedProjectId', () => {
    const input = createV2EnvelopeInput();
    const registry = buildRegistryWithKpi();

    const result = parseScreenProjectEnvelopeInputV2(input, registry, 'other-project');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('VALIDATION');
      expect(result.diagnostics.some((d) => d.path.includes('id'))).toBe(true);
    }
  });

  it('rejects envelope when component type is missing from registry', () => {
    const input = createV2EnvelopeInput();
    // Registry missing the kpi component
    const registry = buildInstanceRegistry([
      { source: 'built-in', manifest: createTextManifest() },
    ]);

    const result = parseScreenProjectEnvelopeInputV2(input, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics.some((d) => d.code === 'MISSING_COMPONENT_DEFINITION')).toBe(true);
    }
  });

  it('rejects envelope when external component props violate manifest propsSchema', () => {
    const input = createV2EnvelopeInput();
    const components = input.document.components as Array<Record<string, unknown>>;
    components[0].props = { title: 'Revenue' }; // missing required 'value'

    const registry = buildRegistryWithKpi();

    const result = parseScreenProjectEnvelopeInputV2(input, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics.some((d) => d.code === 'INVALID_COMPONENT_PROPS')).toBe(true);
    }
  });

  it('rejects non-envelope input', () => {
    const registry = buildRegistryWithKpi();

    const result = parseScreenProjectEnvelopeInputV2({ not: 'an envelope' }, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('VALIDATION');
    }
  });
});

describe('parseScreenProjectDraftV2 — V2 draft parser (Spec §12.3)', () => {
  it('parses a valid V2 draft', () => {
    const registry = buildRegistryWithKpi();
    const draft = {
      name: 'KPI Dashboard',
      description: 'External KPI card project',
      document: createV2DocumentWithKpi(),
    };

    const result = parseScreenProjectDraftV2(draft, registry);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('KPI Dashboard');
      expect(result.data.document.components).toHaveLength(2);
    }
  });

  it('preserves external component props through draft parse', () => {
    const registry = buildRegistryWithKpi();
    const draft = {
      name: 'KPI Dashboard',
      document: createV2DocumentWithKpi(),
    };

    const result = parseScreenProjectDraftV2(draft, registry);

    expect(result.success).toBe(true);
    if (result.success) {
      const kpi = result.data.document.components[0];
      expect(kpi?.props).toEqual({ title: 'Revenue', value: 1_280_500, unit: 'USD' });
    }
  });

  it('rejects draft with missing component definition', () => {
    const registry = buildInstanceRegistry([
      { source: 'built-in', manifest: createTextManifest() },
    ]);
    const draft = {
      name: 'KPI Dashboard',
      document: createV2DocumentWithKpi(),
    };

    const result = parseScreenProjectDraftV2(draft, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics.some((d) => d.code === 'MISSING_COMPONENT_DEFINITION')).toBe(true);
    }
  });

  it('rejects draft with blank name', () => {
    const registry = buildRegistryWithKpi();
    const draft = {
      name: '   ',
      document: createV2DocumentWithKpi(),
    };

    const result = parseScreenProjectDraftV2(draft, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('VALIDATION');
    }
  });
});

describe('parseScreenProjectTransferV2 — V2 transfer parser (Spec §12.3 + Requirement 8)', () => {
  it('parses a valid V2 transfer with external component', () => {
    const registry = buildRegistryWithKpi();
    const transfer = createV2Transfer();

    const result = parseScreenProjectTransferV2(transfer, registry);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.format).toBe('nebula-screen');
      expect(result.data.formatVersion).toBe(2);
      expect(result.data.name).toBe('KPI Dashboard');
      expect(result.data.document.schemaVersion).toBe(2);
      expect(result.data.document.components).toHaveLength(2);
    }
  });

  it('preserves external component props through transfer parse', () => {
    const registry = buildRegistryWithKpi();
    const transfer = createV2Transfer();

    const result = parseScreenProjectTransferV2(transfer, registry);

    expect(result.success).toBe(true);
    if (result.success) {
      const kpi = result.data.document.components[0];
      expect(kpi?.props).toEqual({ title: 'Revenue', value: 1_280_500, unit: 'USD' });
    }
  });

  it('rejects transfer with wrong format identifier', () => {
    const registry = buildRegistryWithKpi();
    const transfer = {
      ...createV2Transfer(),
      format: 'other-format',
    };

    const result = parseScreenProjectTransferV2(transfer, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('VALIDATION');
    }
  });

  it('rejects transfer with missing component definition', () => {
    const registry = buildInstanceRegistry([
      { source: 'built-in', manifest: createTextManifest() },
    ]);
    const transfer = createV2Transfer();

    const result = parseScreenProjectTransferV2(transfer, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics.some((d) => d.code === 'MISSING_COMPONENT_DEFINITION')).toBe(true);
    }
  });

  it('rejects transfer with invalid external component props', () => {
    const registry = buildRegistryWithKpi();
    const transfer = createV2Transfer();
    const components = transfer.document.components as Array<Record<string, unknown>>;
    components[0].props = { title: 'Revenue', value: 'not-a-number' };

    const result = parseScreenProjectTransferV2(transfer, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics.some((d) => d.code === 'INVALID_COMPONENT_PROPS')).toBe(true);
    }
  });
});

describe('parseScreenProjectExportV2 — structured export parser (Spec §12.3 + Requirement 8)', () => {
  it('parses a valid V2 export with safe fileName', () => {
    const registry = buildRegistryWithKpi();
    const exportPayload = {
      fileName: 'kpi-dashboard.json',
      transfer: createV2Transfer(),
    };

    const result = parseScreenProjectExportV2(exportPayload, registry);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fileName).toBe('kpi-dashboard.json');
      expect(result.data.transfer.formatVersion).toBe(2);
      expect(result.data.transfer.document.components).toHaveLength(2);
    }
  });

  it('preserves external component props through export parse', () => {
    const registry = buildRegistryWithKpi();
    const exportPayload = {
      fileName: 'kpi-dashboard.json',
      transfer: createV2Transfer(),
    };

    const result = parseScreenProjectExportV2(exportPayload, registry);

    expect(result.success).toBe(true);
    if (result.success) {
      const kpi = result.data.transfer.document.components[0];
      expect(kpi?.props).toEqual({ title: 'Revenue', value: 1_280_500, unit: 'USD' });
    }
  });

  it('rejects export with non-json file extension', () => {
    const registry = buildRegistryWithKpi();
    const exportPayload = {
      fileName: 'kpi-dashboard.txt',
      transfer: createV2Transfer(),
    };

    const result = parseScreenProjectExportV2(exportPayload, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('VALIDATION');
    }
  });

  it('rejects export with path segment in fileName', () => {
    const registry = buildRegistryWithKpi();
    const exportPayload = {
      fileName: 'foo/bar.json',
      transfer: createV2Transfer(),
    };

    const result = parseScreenProjectExportV2(exportPayload, registry);

    expect(result.success).toBe(false);
  });

  it('rejects export with backslash path segment in fileName', () => {
    const registry = buildRegistryWithKpi();
    const exportPayload = {
      fileName: 'foo\\bar.json',
      transfer: createV2Transfer(),
    };

    const result = parseScreenProjectExportV2(exportPayload, registry);

    expect(result.success).toBe(false);
  });

  it('rejects export with .. path segment in fileName', () => {
    const registry = buildRegistryWithKpi();
    const exportPayload = {
      fileName: '../escape.json',
      transfer: createV2Transfer(),
    };

    const result = parseScreenProjectExportV2(exportPayload, registry);

    expect(result.success).toBe(false);
  });

  it('rejects export with control character in fileName', () => {
    const registry = buildRegistryWithKpi();
    const exportPayload = {
      fileName: 'kpi\n-dashboard.json',
      transfer: createV2Transfer(),
    };

    const result = parseScreenProjectExportV2(exportPayload, registry);

    expect(result.success).toBe(false);
  });

  it('rejects export with empty fileName', () => {
    const registry = buildRegistryWithKpi();
    const exportPayload = {
      fileName: '',
      transfer: createV2Transfer(),
    };

    const result = parseScreenProjectExportV2(exportPayload, registry);

    expect(result.success).toBe(false);
  });

  it('rejects export with missing transfer field', () => {
    const registry = buildRegistryWithKpi();
    const exportPayload = {
      fileName: 'kpi-dashboard.json',
    };

    const result = parseScreenProjectExportV2(exportPayload, registry);

    expect(result.success).toBe(false);
  });

  it('rejects export with invalid transfer (missing component definition)', () => {
    const registry = buildInstanceRegistry([
      { source: 'built-in', manifest: createTextManifest() },
    ]);
    const exportPayload = {
      fileName: 'kpi-dashboard.json',
      transfer: createV2Transfer(),
    };

    const result = parseScreenProjectExportV2(exportPayload, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics.some((d) => d.code === 'MISSING_COMPONENT_DEFINITION')).toBe(true);
    }
  });
});

describe('cloneScreenProjectDraftV2 / cloneScreenProjectTransferV2 — detached snapshots', () => {
  it('returns detached V2 draft snapshots including nested props', () => {
    const draft = {
      name: 'KPI Dashboard',
      document: createV2DocumentWithKpi(),
    };
    const clone = cloneScreenProjectDraftV2(draft);
    const kpi = clone.document.components[0];
    if (kpi) {
      kpi.props = { ...kpi.props, title: 'Mutated' };
    }

    const original = draft.document.components[0];
    expect(original?.props).toEqual({ title: 'Revenue', value: 1_280_500, unit: 'USD' });
  });

  it('returns detached V2 transfer snapshots', () => {
    const transfer = createV2Transfer();
    const clone = cloneScreenProjectTransferV2(transfer);
    const kpi = clone.document.components[0];
    if (kpi) {
      kpi.props = { ...kpi.props, value: 0 };
    }

    const original = transfer.document.components[0];
    expect(original?.props).toEqual({ title: 'Revenue', value: 1_280_500, unit: 'USD' });
  });
});

describe('external component round-trip — load/save/reload/import/export/snapshot (Requirement 8)', () => {
  const registry = buildRegistryWithKpi();
  const expectedProps = { title: 'Revenue', value: 1_280_500, unit: 'USD' };

  it('preserves KPI card props through load → save → reload round-trip', () => {
    // Step 1: load — V2 envelope from Adapter.loadProject
    const loadInput = createV2EnvelopeInput();
    const loadResult = parseScreenProjectEnvelopeInputV2(loadInput, registry);
    expect(loadResult.success).toBe(true);
    if (!loadResult.success) return;

    // Step 2: save — V2 draft to Adapter.saveProject
    const draft = {
      name: loadResult.data.name,
      description: loadResult.data.description,
      document: loadResult.data.document,
    };
    const saveResult = parseScreenProjectDraftV2(draft, registry);
    expect(saveResult.success).toBe(true);

    // Step 3: reload — V2 envelope returned by saveProject
    const reloadEnvelope: ScreenProjectEnvelopeInputV2 = {
      id: loadResult.data.id,
      name: saveResult.success ? saveResult.data.name : '',
      description: saveResult.success ? saveResult.data.description : null,
      status: 'draft',
      revision: 'rev-2',
      document: saveResult.success ? saveResult.data.document : loadResult.data.document,
    };
    const reloadResult = parseScreenProjectEnvelopeInputV2(reloadEnvelope, registry);
    expect(reloadResult.success).toBe(true);
    if (!reloadResult.success) return;

    // Props preserved through entire round-trip
    const kpi = reloadResult.data.document.components[0];
    expect(kpi?.type).toBe('acme.kpi/v1');
    expect(kpi?.props).toEqual(expectedProps);
  });

  it('preserves KPI card props through import → export round-trip', () => {
    // Step 1: import — V2 transfer from import file
    const transfer = createV2Transfer();
    const importResult = parseScreenProjectTransferV2(transfer, registry);
    expect(importResult.success).toBe(true);
    if (!importResult.success) return;

    // Step 2: export — V2 export from Adapter.exportProject
    const exportPayload = {
      fileName: 'kpi-dashboard.json',
      transfer: {
        format: 'nebula-screen',
        formatVersion: 2,
        name: importResult.data.name,
        description: importResult.data.description,
        document: importResult.data.document,
      },
    };
    const exportResult = parseScreenProjectExportV2(exportPayload, registry);
    expect(exportResult.success).toBe(true);
    if (!exportResult.success) return;

    // Props preserved through import → export
    const kpi = exportResult.data.transfer.document.components[0];
    expect(kpi?.props).toEqual(expectedProps);
  });

  it('preserves KPI card props through snapshot create → restore round-trip', () => {
    // Step 1: snapshot create — V2 draft to ScreenSnapshotAdapterV2.create
    const draft = {
      name: 'KPI Dashboard',
      description: 'snapshot',
      document: createV2DocumentWithKpi(),
    };
    const createResult = parseScreenProjectDraftV2(draft, registry);
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;

    // Step 2: snapshot restore — V2 envelope from ScreenSnapshotAdapterV2.restore
    const restoredEnvelope: ScreenProjectEnvelopeInputV2 = {
      id: 'proj-kpi-1',
      name: createResult.data.name,
      description: createResult.data.description,
      status: 'draft',
      revision: 'rev-1',
      document: createResult.data.document,
    };
    const restoreResult = parseScreenProjectEnvelopeInputV2(restoredEnvelope, registry);
    expect(restoreResult.success).toBe(true);
    if (!restoreResult.success) return;

    // Props preserved through snapshot round-trip
    const kpi = restoreResult.data.document.components[0];
    expect(kpi?.props).toEqual(expectedProps);
  });
});

describe('document field rejection — tagName/moduleUrl/script (Requirement 12)', () => {
  const registry = buildRegistryWithKpi();

  it('rejects V2 document with tagName field at component level', () => {
    const doc = createV2DocumentWithKpi();
    const components = doc.components as Array<Record<string, unknown>>;
    components[0].tagName = 'acme-kpi-card';

    const result = parseScreenDocumentV2(doc, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('VALIDATION');
    }
  });

  it('rejects V2 document with moduleUrl field at component level', () => {
    const doc = createV2DocumentWithKpi();
    const components = doc.components as Array<Record<string, unknown>>;
    components[0].moduleUrl = 'https://evil.example.com/kpi.js';

    const result = parseScreenDocumentV2(doc, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('VALIDATION');
    }
  });

  it('rejects V2 document with script field at component level', () => {
    const doc = createV2DocumentWithKpi();
    const components = doc.components as Array<Record<string, unknown>>;
    components[0].script = 'alert(1)';

    const result = parseScreenDocumentV2(doc, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('VALIDATION');
    }
  });

  it('rejects V2 document with script field at document level', () => {
    const doc = {
      ...createV2DocumentWithKpi(),
      script: 'alert(1)',
    };

    const result = parseScreenDocumentV2(doc, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('VALIDATION');
    }
  });

  it('rejects V2 transfer with tagName field at component level', () => {
    const transfer = createV2Transfer();
    const components = transfer.document.components as Array<Record<string, unknown>>;
    components[0].tagName = 'acme-kpi-card';

    const result = parseScreenProjectTransferV2(transfer, registry);

    expect(result.success).toBe(false);
  });

  it('rejects V2 export with moduleUrl in transfer document', () => {
    const exportPayload = {
      fileName: 'kpi.json',
      transfer: createV2Transfer(),
    };
    const components = exportPayload.transfer.document.components as Array<Record<string, unknown>>;
    components[0].moduleUrl = 'https://evil.example.com/kpi.js';

    const result = parseScreenProjectExportV2(exportPayload, registry);

    expect(result.success).toBe(false);
  });
});

describe('V1/V2 transfer cross-embedding rejection (Spec §12.3)', () => {
  it('V1 transfer schema rejects embedded V2 document (schemaVersion=2)', () => {
    // V1 transfer (formatVersion=1) wrapping a V2 document (schemaVersion=2)
    const v1TransferWithV2Doc = {
      format: 'nebula-screen',
      formatVersion: 1,
      name: 'Cross-embed',
      document: {
        ...createV2DocumentWithKpi(),
        schemaVersion: 2, // V2 document in V1 transfer
      },
    };

    const result = ScreenProjectTransferV1Schema.safeParse(v1TransferWithV2Doc);

    expect(result.success).toBe(false);
  });

  it('V2 transfer parser rejects embedded V1 document (schemaVersion=1)', () => {
    const registry = buildRegistryWithKpi();
    // V2 transfer (formatVersion=2) wrapping a V1 document (schemaVersion=1)
    const v2TransferWithV1Doc = {
      format: 'nebula-screen',
      formatVersion: 2,
      name: 'Cross-embed',
      document: {
        ...createV2DocumentWithKpi(),
        schemaVersion: 1, // V1 document in V2 transfer
      },
    };

    const result = parseScreenProjectTransferV2(v2TransferWithV1Doc, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('VALIDATION');
    }
  });

  it('V1 transfer schema rejects V2 formatVersion', () => {
    // V1 transfer schema requires formatVersion=1
    const v2Transfer = {
      format: 'nebula-screen',
      formatVersion: 2,
      name: 'V2 transfer',
      document: createV2DocumentWithKpi(),
    };

    const result = ScreenProjectTransferV1Schema.safeParse(v2Transfer);

    expect(result.success).toBe(false);
  });

  it('V2 transfer schema rejects V1 formatVersion', () => {
    const registry = buildRegistryWithKpi();
    // V2 transfer schema requires formatVersion=2
    const v1Transfer = {
      format: 'nebula-screen',
      formatVersion: 1,
      name: 'V1 transfer',
      document: {
        ...createV2DocumentWithKpi(),
        schemaVersion: 1,
      },
    };

    const result = parseScreenProjectTransferV2(v1Transfer, registry);

    expect(result.success).toBe(false);
  });
});
