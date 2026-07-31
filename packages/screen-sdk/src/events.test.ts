import { dispatchScreenEditorRequestEvent, type ScreenPreviewRequestDetail } from './events.js';

describe('dispatchScreenEditorRequestEvent', () => {
  it('dispatches a bubbling composed navigate request with its detail', () => {
    const parent = document.createElement('div');
    const target = document.createElement('div');
    const listener = vi.fn<(event: Event) => void>();
    parent.append(target);
    parent.addEventListener('nebula-navigate-request', listener);

    const detail = {
      projectId: 'screen-1',
      target: '_blank' as const,
      url: 'https://example.com',
    };
    dispatchScreenEditorRequestEvent(target, 'nebula-navigate-request', detail);

    expect(listener).toHaveBeenCalledOnce();
    const event = listener.mock.calls[0]?.[0];
    expect(event).toBeInstanceOf(CustomEvent);
    expect(event?.bubbles).toBe(true);
    expect(event?.composed).toBe(true);
    expect((event as CustomEvent).detail).toEqual(detail);
  });

  it('dispatches the static preview draft contract', () => {
    const target = document.createElement('div');
    const listener = vi.fn<(event: Event) => void>();
    target.addEventListener('nebula-preview-request', listener);

    dispatchScreenEditorRequestEvent(target, 'nebula-preview-request', {
      projectId: 'screen-1',
      revision: 'revision-1',
      draft: {
        name: 'Screen',
        description: null,
        document: {
          schemaVersion: 1,
          canvas: {
            width: 1920,
            height: 1080,
            backgroundColor: '#000000',
            scaleMode: 'fit',
          },
          components: [],
          globalVariables: [],
        },
      },
    });

    expect(listener).toHaveBeenCalledOnce();
    const event = listener.mock.calls[0]?.[0] as CustomEvent<ScreenPreviewRequestDetail>;
    expect(event.detail.revision).toBe('revision-1');
  });
});
