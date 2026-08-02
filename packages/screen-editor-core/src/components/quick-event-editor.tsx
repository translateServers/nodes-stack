import type { JSX } from 'react';
import { Workflow } from 'lucide-react';

import { useScreenEditorStore } from '../stores/editor-store.js';
import { Button } from '@nebula/screen-editor-core/internal';
import { PanelSection } from './ui-primitives/panel-section.js';

interface QuickEventEditorProps {
  readonly componentId: string;
}

/** Opens the full event editor scoped to the selected component. */
export function QuickEventEditor({ componentId }: QuickEventEditorProps): JSX.Element {
  const openBlueprintSheet = useScreenEditorStore((state) => state.openBlueprintSheet);

  return (
    <PanelSection title="事件" testId="quick-event-editor">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2"
        onClick={() => openBlueprintSheet({ focusComponentId: componentId })}
      >
        <Workflow className="size-4" />
        编辑事件蓝图
      </Button>
    </PanelSection>
  );
}
