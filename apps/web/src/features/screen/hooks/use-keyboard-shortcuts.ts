import { useEffect, useCallback } from 'react';
import hotkeys from 'hotkeys-js';
import { useScreenEditorStore } from '../stores/editor-store';
import type { ScreenComponent } from '@nebula/shared';

export function useKeyboardShortcuts(onSave: () => void) {
  const saveRef = useLatestRef(onSave);

  const getStore = useCallback(() => useScreenEditorStore.getState(), []);

  useEffect(() => {
    hotkeys.filter = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const tagName = target.tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
        if (hotkeys.getPressedKeyCodes().includes(83) && (event.ctrlKey || event.metaKey)) {
          return true;
        }
        return false;
      }
      return !target.isContentEditable;
    };

    hotkeys('ctrl+s, command+s', (e) => {
      e.preventDefault();
      saveRef.current();
    });

    hotkeys('escape', () => {
      getStore().clearSelection();
    });

    hotkeys('delete, backspace', (e) => {
      e.preventDefault();
      getStore().removeSelectedComponents();
    });

    hotkeys('ctrl+a, command+a', (e) => {
      e.preventDefault();
      const store = getStore();
      if (store.project) {
        const allIds = store.project.components
          .filter((c: ScreenComponent) => !c.status.locked && !c.status.hidden)
          .map((c: ScreenComponent) => c.id);
        store.selectComponents(allIds);
      }
    });

    hotkeys('ctrl+d, command+d', (e) => {
      e.preventDefault();
      getStore().duplicateSelected();
    });

    hotkeys('ctrl+z, command+z', (e) => {
      e.preventDefault();
      getStore().undo();
    });

    hotkeys('ctrl+shift+z, command+shift+z', (e) => {
      e.preventDefault();
      getStore().redo();
    });

    hotkeys('ctrl+l', () => {
      const store = getStore();
      store.setLocked(store.selectedComponentIds, true);
    });

    hotkeys('ctrl+shift+l', () => {
      const store = getStore();
      store.setLocked(store.selectedComponentIds, false);
    });

    hotkeys('ctrl+h', () => {
      const store = getStore();
      store.setHidden(store.selectedComponentIds, true);
    });

    hotkeys('up', () => getStore().nudgeSelected(0, -1));
    hotkeys('down', () => getStore().nudgeSelected(0, 1));
    hotkeys('left', () => getStore().nudgeSelected(-1, 0));
    hotkeys('right', () => getStore().nudgeSelected(1, 0));

    hotkeys('shift+up', () => getStore().nudgeSelected(0, -10));
    hotkeys('shift+down', () => getStore().nudgeSelected(0, 10));
    hotkeys('shift+left', () => getStore().nudgeSelected(-10, 0));
    hotkeys('shift+right', () => getStore().nudgeSelected(10, 0));

    hotkeys('ctrl+k', () => {
      getStore().toggleBorderGuides();
    });

    return () => {
      hotkeys.unbind('ctrl+s, command+s');
      hotkeys.unbind('escape');
      hotkeys.unbind('delete, backspace');
      hotkeys.unbind('ctrl+a, command+a');
      hotkeys.unbind('ctrl+d, command+d');
      hotkeys.unbind('ctrl+z, command+z');
      hotkeys.unbind('ctrl+shift+z, command+shift+z');
      hotkeys.unbind('ctrl+l');
      hotkeys.unbind('ctrl+shift+l');
      hotkeys.unbind('ctrl+h');
      hotkeys.unbind('up');
      hotkeys.unbind('down');
      hotkeys.unbind('left');
      hotkeys.unbind('right');
      hotkeys.unbind('shift+up');
      hotkeys.unbind('shift+down');
      hotkeys.unbind('shift+left');
      hotkeys.unbind('shift+right');
      hotkeys.unbind('ctrl+k');
    };
  }, [getStore, saveRef]);
}

function useLatestRef<T>(value: T): { current: T } {
  const ref = { current: value };
  ref.current = value;
  return ref;
}
