import { describe, expect, it } from 'vitest';
import { BLUEPRINT_CLIPBOARD_KIND, type BlueprintClipboardV2 } from '@nebula/shared';
import { isStaticClipboardPayload } from './use-blueprint-clipboard-v2';

function createPayload(): BlueprintClipboardV2 {
  return {
    kind: BLUEPRINT_CLIPBOARD_KIND,
    nodes: [
      {
        id: 'comment-1',
        kind: 'comment',
        position: { x: 0, y: 0 },
        config: { text: 'Comment' },
      },
    ],
    edges: [],
  };
}

describe('isStaticClipboardPayload', () => {
  it('accepts static control-flow nodes and handles', () => {
    const payload = createPayload();
    payload.nodes = [
      {
        id: 'delay-1',
        kind: 'delay',
        position: { x: 0, y: 0 },
        config: { delayMs: 100 },
      },
      {
        id: 'navigate-1',
        kind: 'component',
        componentId: 'global',
        globalType: 'navigate',
        position: { x: 100, y: 0 },
        config: { globalType: 'navigate', url: 'https://example.com', target: '_blank' },
      },
    ];
    payload.edges = [
      {
        id: 'edge-1',
        source: 'delay-1',
        sourceHandle: 'out',
        target: 'navigate-1',
        targetHandle: 'act:navigate',
      },
    ];

    expect(isStaticClipboardPayload(payload)).toBe(true);
  });

  it('rejects requestApi nodes and dynamic data handles', () => {
    const requestPayload = createPayload();
    requestPayload.nodes = [
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
    ];
    const refreshPayload = createPayload();
    refreshPayload.edges = [
      {
        id: 'edge-1',
        source: 'comment-1',
        sourceHandle: 'evt:dataLoaded',
        target: 'comment-1',
        targetHandle: 'act:refreshData',
      },
    ];

    expect(isStaticClipboardPayload(requestPayload)).toBe(false);
    expect(isStaticClipboardPayload(refreshPayload)).toBe(false);
  });
});
