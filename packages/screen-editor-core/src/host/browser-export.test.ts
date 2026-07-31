import { downloadScreenExportFile } from './browser-export.js';

describe('downloadScreenExportFile', () => {
  it('uses the validated basename and always revokes the object URL', () => {
    const createObjectUrl = vi.fn(() => 'blob:screen-export');
    const revokeObjectUrl = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: createObjectUrl,
      revokeObjectURL: revokeObjectUrl,
    });

    downloadScreenExportFile({
      fileName: 'screen.json',
      blob: new Blob(['{}'], { type: 'application/json' }),
    });

    expect(click).toHaveBeenCalledOnce();
    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:screen-export');
    expect(document.querySelector('a[download="screen.json"]')).toBeNull();
    vi.unstubAllGlobals();
  });
});
