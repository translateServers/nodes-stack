import type { DataSourceConfig } from '@nebula/shared';
import { describe, expect, it } from 'vitest';
import {
  createScreenEditorWorkbenchProject,
  type ScreenEditorWorkbenchEnvelope,
} from './screen-editor-workbench-project';

function createEnvelope(): ScreenEditorWorkbenchEnvelope {
  return {
    id: 'project-1',
    name: 'Static project',
    description: null,
    status: 'draft',
    revision: 'revision-1',
    document: {
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
          position: { x: 0, y: 0, width: 200, height: 60 },
          style: {},
          props: { content: 'Hello' },
          status: { locked: false, hidden: false },
          zIndex: 0,
        },
      ],
      globalVariables: [],
    },
  };
}

describe('createScreenEditorWorkbenchProject', () => {
  it('maps a validated static Envelope to the internal Store project', () => {
    expect(createScreenEditorWorkbenchProject(createEnvelope(), 'static')).toMatchObject({
      success: true,
      project: {
        id: 'project-1',
        updatedAt: 'revision-1',
        components: [{ id: 'text-1' }],
      },
    });
  });

  it.each<DataSourceConfig>([
    { type: 'api', apiConfig: { url: 'https://example.com', method: 'GET' } },
    { type: 'dataset', datasetId: 'dataset-1' },
  ])('rejects $type data sources in the static profile', (dataSource) => {
    const envelope = createEnvelope();
    const component = envelope.document.components[0];
    if (component === undefined) throw new Error('Test component is required');
    envelope.document.components[0] = {
      ...component,
      dataSource,
    };

    expect(createScreenEditorWorkbenchProject(envelope, 'static')).toEqual({ success: false });
    expect(createScreenEditorWorkbenchProject(envelope, 'dynamic').success).toBe(true);
  });

  it('rejects requestApi without mutating the input Envelope', () => {
    const envelope = createEnvelope();
    envelope.document.blueprint = {
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
            headers: {},
            body: '',
            secretHeaderKeys: [],
            timeoutMs: 1000,
          },
        },
      ],
      edges: [],
    };
    const before = structuredClone(envelope);

    expect(createScreenEditorWorkbenchProject(envelope, 'static')).toEqual({ success: false });
    expect(envelope).toEqual(before);
  });
});
