/**
 * Screen Document V2 wire/domain contract tests（Spec §12.2 / §12.3, Task 5.1）
 *
 * 仅测试 V2 业务约束：
 * - V2 wire 接受外部组件 type（与 V1 六分支严格联合的差异）
 * - V2 wire 拒绝 tagName/moduleUrl/script（Requirement 12: no document-driven code loading）
 * - V2 transfer formatVersion=2 不得嵌入 V1 document
 * - V2 export fileName 安全规则（路径段/控制字符/扩展名）
 * - V2 diagnostic code 联合包含 registry error codes 与新增组件 codes
 * - V1 schema 不被 V2 改动影响（回归保护）
 *
 * 不测试 Zod 框架自身能力（strict/passthrough/literal 的通用行为）。
 */

import { describe, expect, it } from 'vitest';
import {
  SCREEN_DOCUMENT_V2_VERSION,
  SCREEN_TRANSFER_FORMAT_VERSION_V2,
  ScreenDocumentV1Schema,
  ScreenDocumentV2WireJsonSchema,
  ScreenDocumentV2WireSchema,
  ScreenProjectExportV2JsonSchema,
  ScreenProjectExportV2Schema,
  ScreenProjectTransferV2Schema,
  type ScreenDocumentV2,
  type ScreenSdkDiagnosticCodeV2,
} from './index.js';

function createV2Document(): ScreenDocumentV2 {
  return ScreenDocumentV2WireSchema.parse({
    schemaVersion: 2,
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

describe('ScreenDocumentV2WireSchema — wire shape', () => {
  it('accepts external component types with arbitrary JSON props (V2 vs V1 semantic)', () => {
    const input = structuredClone(createV2Document()) as Record<string, unknown>;
    const components = input.components as Array<Record<string, unknown>>;
    components[0] = {
      ...components[0],
      id: 'kpi-1',
      type: 'acme.kpi/v1',
      props: { value: 42, unit: 'ms', trend: [1, 2, 3], nested: { a: true } },
    };

    const result = ScreenDocumentV2WireSchema.safeParse(input);

    expect(result.success).toBe(true);
  });

  it.each([
    'tagName',
    'moduleUrl',
    'script',
  ])('rejects component-level %s field (Requirement 12: no document-driven code loading)', (field) => {
    const input = structuredClone(createV2Document()) as Record<string, unknown>;
    const components = input.components as Array<Record<string, unknown>>;
    components[0] = { ...components[0], [field]: 'https://evil.example/evil.js' };

    const result = ScreenDocumentV2WireSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it('rejects document-level tagName/moduleUrl/script fields', () => {
    const input = structuredClone(createV2Document()) as Record<string, unknown>;
    input.tagName = 'nebula-evil';

    const result = ScreenDocumentV2WireSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it('rejects schemaVersion=1 (V2 wire must be schemaVersion=2)', () => {
    const input = { ...createV2Document(), schemaVersion: 1 };

    expect(ScreenDocumentV2WireSchema.safeParse(input).success).toBe(false);
  });

  it('rejects future schemaVersion=3', () => {
    const input = { ...createV2Document(), schemaVersion: 3 };

    expect(ScreenDocumentV2WireSchema.safeParse(input).success).toBe(false);
  });

  it('accepts dataSource/logic/interaction on wire (parser enforces capability per Requirement 14)', () => {
    const input = structuredClone(createV2Document()) as Record<string, unknown>;
    const components = input.components as Array<Record<string, unknown>>;
    components[0] = {
      ...components[0],
      dataSource: { type: 'static', staticData: [{ name: 'A', value: 1 }] },
      logic: { sortDirection: 'desc' },
      interaction: { tooltipOnHover: true },
    };

    expect(ScreenDocumentV2WireSchema.safeParse(input).success).toBe(true);
  });

  it('accepts V2 blueprint', () => {
    const input = structuredClone(createV2Document()) as Record<string, unknown>;
    input.blueprint = {
      version: 2,
      nodes: [
        {
          id: 'component-1',
          kind: 'component',
          componentId: 'text-1',
          position: { x: 0, y: 0 },
        },
      ],
      edges: [],
    };

    expect(ScreenDocumentV2WireSchema.safeParse(input).success).toBe(true);
  });
});

describe('ScreenProjectTransferV2Schema — format isolation', () => {
  function createV2Transfer(): Record<string, unknown> {
    return {
      format: 'nebula-screen',
      formatVersion: 2,
      name: 'Example',
      document: createV2Document(),
    };
  }

  it('accepts a valid V2 transfer', () => {
    expect(ScreenProjectTransferV2Schema.safeParse(createV2Transfer()).success).toBe(true);
  });

  it('rejects V1 document embedded in V2 transfer (schemaVersion mismatch)', () => {
    const input = createV2Transfer();
    const document = input.document as Record<string, unknown>;
    document.schemaVersion = 1;

    expect(ScreenProjectTransferV2Schema.safeParse(input).success).toBe(false);
  });

  it('rejects formatVersion=1 in V2 transfer', () => {
    const input = { ...createV2Transfer(), formatVersion: 1 };

    expect(ScreenProjectTransferV2Schema.safeParse(input).success).toBe(false);
  });

  it('rejects wrong format string', () => {
    const input = { ...createV2Transfer(), format: 'other-format' };

    expect(ScreenProjectTransferV2Schema.safeParse(input).success).toBe(false);
  });
});

describe('ScreenProjectExportV2Schema — fileName safety', () => {
  function createExport(fileName: string): Record<string, unknown> {
    return {
      fileName,
      transfer: {
        format: 'nebula-screen',
        formatVersion: 2,
        name: 'Example',
        document: createV2Document(),
      },
    };
  }

  it.each([
    '../screen.json',
    'folder/screen.json',
    'screen..json',
    'screen.txt',
    'screen.json.exe',
    '',
  ])('rejects unsafe filename %s', (fileName) => {
    expect(ScreenProjectExportV2Schema.safeParse(createExport(fileName)).success).toBe(false);
  });

  it.each([
    'screen\u0000.json',
    'screen\u001f.json',
    'screen\u007f.json',
  ])('rejects control character in filename %s', (fileName) => {
    expect(ScreenProjectExportV2Schema.safeParse(createExport(fileName)).success).toBe(false);
  });

  it('enforces 255-character filename limit', () => {
    const validName = `${'a'.repeat(250)}.json`;
    const invalidName = `${'a'.repeat(251)}.json`;

    expect(ScreenProjectExportV2Schema.safeParse(createExport(validName)).success).toBe(true);
    expect(ScreenProjectExportV2Schema.safeParse(createExport(invalidName)).success).toBe(false);
  });

  it('rejects non-V2 transfer in export payload', () => {
    const input = createExport('screen.json');
    const transfer = input.transfer as Record<string, unknown>;
    transfer.formatVersion = 1;

    expect(ScreenProjectExportV2Schema.safeParse(input).success).toBe(false);
  });

  it('accepts a safe .json basename', () => {
    expect(ScreenProjectExportV2Schema.safeParse(createExport('screen-export.json')).success).toBe(
      true,
    );
  });
});

describe('ScreenSdkDiagnosticCodeV2 — code union', () => {
  it('V2 code union includes V1 codes', () => {
    const v1Code: ScreenSdkDiagnosticCodeV2 = 'INVALID_DOCUMENT';
    expect(v1Code).toBe('INVALID_DOCUMENT');
  });

  it('V2 code union includes registry error codes', () => {
    const registryCode: ScreenSdkDiagnosticCodeV2 = 'INVALID_COMPONENT_MANIFEST';
    expect(registryCode).toBe('INVALID_COMPONENT_MANIFEST');
  });

  it('V2 code union includes new component codes', () => {
    const codes: ScreenSdkDiagnosticCodeV2[] = [
      'MISSING_COMPONENT_DEFINITION',
      'UNSUPPORTED_COMPONENT_CAPABILITY',
      'INVALID_COMPONENT_EVENT',
    ];

    expect(codes).toHaveLength(3);
  });
});

describe('V2 JSON Schema generation', () => {
  it('document wire JSON Schema contains schemaVersion const 2', () => {
    const schema = JSON.stringify(ScreenDocumentV2WireJsonSchema);

    expect(schema).toContain('"schemaVersion"');
    expect(schema).toContain('2');
  });

  it('export JSON Schema contains fileName and transfer constraints', () => {
    const schema = JSON.stringify(ScreenProjectExportV2JsonSchema);

    expect(schema).toContain('fileName');
    expect(schema).toContain('transfer');
    expect(schema).toContain('\\.json');
  });

  it('transfer JSON Schema contains formatVersion const 2', () => {
    const schema = JSON.stringify(ScreenProjectExportV2JsonSchema);

    expect(schema).toContain('formatVersion');
    expect(schema).toContain('2');
  });
});

describe('V1 regression — V2 additions do not alter V1 behavior', () => {
  it('V1 schema still rejects external component types', () => {
    const input = {
      schemaVersion: 1,
      canvas: {
        width: 1920,
        height: 1080,
        backgroundColor: '#000000',
        scaleMode: 'fit',
      },
      components: [
        {
          id: 'kpi-1',
          type: 'acme.kpi/v1',
          name: 'KPI',
          position: { x: 0, y: 0, width: 200, height: 80 },
          style: {},
          props: { value: 42 },
          status: { locked: false, hidden: false },
          zIndex: 1,
        },
      ],
      globalVariables: [],
    };

    expect(ScreenDocumentV1Schema.safeParse(input).success).toBe(false);
  });

  it('V1 schema still accepts six built-in component types', () => {
    const input = {
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
    };

    expect(ScreenDocumentV1Schema.safeParse(input).success).toBe(true);
  });
});

describe('version constants', () => {
  it('SCREEN_DOCUMENT_V2_VERSION is 2', () => {
    expect(SCREEN_DOCUMENT_V2_VERSION).toBe(2);
  });

  it('SCREEN_TRANSFER_FORMAT_VERSION_V2 is 2', () => {
    expect(SCREEN_TRANSFER_FORMAT_VERSION_V2).toBe(2);
  });
});
