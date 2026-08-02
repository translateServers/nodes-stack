import {
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Braces, CircleAlert, GripVertical } from 'lucide-react';
import type { ScreenComponent } from '@nebula/shared';
import {
  createEditableComponentJsonSchema,
  extractEditableComponentConfig,
  formatEditableComponentJson,
  isStructurallyEqual,
  serializeEditableComponentConfig,
  validateEditableComponentJson,
  type ComponentJsonConfigDiagnostic,
  type EditableScreenComponentConfig,
  type ProtectedScreenComponentIdentity,
} from '../lib/component-json-config.js';
import { useRegistry } from '../registry/registry-context.js';
import { useScreenEditorStore, useScreenEditorStoreApi } from '../stores/editor-store.js';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from '@nebula/screen-editor-core/internal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog.js';
import { useScreenEditorEnvironment } from './screen-editor-environment.js';
import type {
  ComponentJsonEditorComponent,
  ComponentJsonEditorDiagnostic,
} from './component-json-editor.js';

interface ComponentJsonEditorDialogProps {
  readonly componentId: string | null;
  readonly editor: ComponentJsonEditorComponent;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
}

interface FloatingDialogPosition {
  readonly x: number;
  readonly y: number;
}

interface DialogDragSession extends FloatingDialogPosition {
  readonly pointerId: number;
  readonly startClientX: number;
  readonly startClientY: number;
}

interface ComponentJsonEditorSession {
  readonly baseline: EditableScreenComponentConfig;
  readonly identity: ProtectedScreenComponentIdentity;
}

const FLOATING_DIALOG_MARGIN = 16;

function clampDialogPosition(
  position: FloatingDialogPosition,
  dialog: HTMLElement,
): FloatingDialogPosition {
  const maxX = Math.max(
    FLOATING_DIALOG_MARGIN,
    window.innerWidth - dialog.offsetWidth - FLOATING_DIALOG_MARGIN,
  );
  const maxY = Math.max(
    FLOATING_DIALOG_MARGIN,
    window.innerHeight - dialog.offsetHeight - FLOATING_DIALOG_MARGIN,
  );
  return {
    x: Math.min(Math.max(FLOATING_DIALOG_MARGIN, position.x), maxX),
    y: Math.min(Math.max(FLOATING_DIALOG_MARGIN, position.y), maxY),
  };
}

function getComponentIdentity(component: ScreenComponent): ProtectedScreenComponentIdentity {
  return {
    id: component.id,
    parentId: component.parentId,
    type: component.type,
  };
}

function getComponentById(
  components: readonly ScreenComponent[] | undefined,
  componentId: string | null,
): ScreenComponent | undefined {
  if (componentId === null) return undefined;
  return components?.find((component) => component.id === componentId);
}

function getDraftIsDirty(draft: string, baseline: EditableScreenComponentConfig | null): boolean {
  if (baseline === null) return false;
  try {
    return !isStructurallyEqual(JSON.parse(draft), baseline);
  } catch {
    return true;
  }
}

function formatPath(path: ReadonlyArray<string | number> | undefined): string {
  if (path === undefined || path.length === 0) return '配置';
  return path.map((segment) => (typeof segment === 'number' ? `[${segment}]` : segment)).join('.');
}

function dedupeDiagnostics(
  diagnostics: readonly (ComponentJsonConfigDiagnostic | ComponentJsonEditorDiagnostic)[],
): readonly (ComponentJsonConfigDiagnostic | ComponentJsonEditorDiagnostic)[] {
  const seen = new Set<string>();
  return diagnostics.filter((diagnostic) => {
    const key = `${diagnostic.severity}:${formatPath(diagnostic.path)}:${diagnostic.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function ComponentJsonEditorDialog({
  componentId,
  editor: Editor,
  onOpenChange,
  open,
}: ComponentJsonEditorDialogProps) {
  const registry = useRegistry();
  const store = useScreenEditorStoreApi();
  const { capabilityProfile, readonly, theme } = useScreenEditorEnvironment();
  const components = useScreenEditorStore((state) => state.project?.components);
  const replaceComponentConfig = useScreenEditorStore((state) => state.replaceComponentConfig);
  const component = getComponentById(components, componentId);
  const [draft, setDraft] = useState('');
  const [editorDiagnostics, setEditorDiagnostics] = useState<
    readonly ComponentJsonEditorDiagnostic[]
  >([]);
  const [applicationDiagnostics, setApplicationDiagnostics] = useState<
    readonly ComponentJsonConfigDiagnostic[]
  >([]);
  const [session, setSession] = useState<ComponentJsonEditorSession | null>(null);
  const [discardConfirmationOpen, setDiscardConfirmationOpen] = useState(false);
  const [floatingPosition, setFloatingPosition] = useState<FloatingDialogPosition | null>(null);
  const modelSessionId = useId().replaceAll(':', '');
  const dialogContentRef = useRef<HTMLDivElement>(null);
  const dragSessionRef = useRef<DialogDragSession | null>(null);
  const floatingPositionRef = useRef<FloatingDialogPosition | null>(null);
  const pendingDragPositionRef = useRef<FloatingDialogPosition | null>(null);
  const dragAnimationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const clampFloatingDialogAfterResize = (): void => {
      const dialog = dialogContentRef.current;
      const current = floatingPositionRef.current;
      if (dialog === null || current === null) return;
      const nextPosition = clampDialogPosition(current, dialog);
      floatingPositionRef.current = nextPosition;
      setFloatingPosition(nextPosition);
    };
    window.addEventListener('resize', clampFloatingDialogAfterResize);
    return () => {
      window.removeEventListener('resize', clampFloatingDialogAfterResize);
      if (dragAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(dragAnimationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!open || componentId === null) return;
    const target = store
      .getState()
      .project?.components.find((candidate) => candidate.id === componentId);
    if (target === undefined) {
      setSession(null);
      setDraft('');
      setApplicationDiagnostics([
        { message: '组件已被删除，无法继续编辑', path: [], severity: 'error' },
      ]);
      return;
    }

    const baseline = extractEditableComponentConfig(target);
    setSession({ baseline, identity: getComponentIdentity(target) });
    setDraft(serializeEditableComponentConfig(baseline));
    setApplicationDiagnostics([]);
    setEditorDiagnostics([]);
    setDiscardConfirmationOpen(false);
  }, [componentId, open, store]);

  const registration = useMemo(
    () => (session === null ? undefined : registry.get(session.identity.type)),
    [registry, session],
  );
  const schema = useMemo(
    () =>
      registration === undefined
        ? undefined
        : createEditableComponentJsonSchema({ capabilityProfile, registration }),
    [capabilityProfile, registration],
  );
  const modelUri = useMemo(() => {
    if (session === null) return `inmemory://nebula-screen/unknown/${modelSessionId}.json`;
    return `inmemory://nebula-screen/${encodeURIComponent(session.identity.id)}/${modelSessionId}.json`;
  }, [modelSessionId, session]);
  const isDraftDirty = useMemo(
    () => getDraftIsDirty(draft, session?.baseline ?? null),
    [draft, session],
  );
  const diagnostics = useMemo(
    () => dedupeDiagnostics([...applicationDiagnostics, ...editorDiagnostics]),
    [applicationDiagnostics, editorDiagnostics],
  );

  const close = useCallback((): void => {
    setDiscardConfirmationOpen(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const requestOpenChange = useCallback(
    (nextOpen: boolean): void => {
      if (nextOpen) {
        onOpenChange(true);
        return;
      }
      if (!readonly && isDraftDirty) {
        setDiscardConfirmationOpen(true);
        return;
      }
      close();
    },
    [close, isDraftDirty, onOpenChange, readonly],
  );

  const handleFormat = useCallback((): void => {
    try {
      setDraft(formatEditableComponentJson(draft));
      setApplicationDiagnostics([]);
    } catch {
      setApplicationDiagnostics([
        { message: 'JSON 格式错误，无法格式化', path: [], severity: 'error' },
      ]);
    }
  }, [draft]);

  const handleApply = useCallback((): void => {
    if (session === null) {
      setApplicationDiagnostics([{ message: '组件配置不可用', path: [], severity: 'error' }]);
      return;
    }
    const validation = validateEditableComponentJson(draft, {
      capabilityProfile,
      identity: session.identity,
      registry,
    });
    if (!validation.success) {
      setApplicationDiagnostics(validation.diagnostics);
      return;
    }

    const result = replaceComponentConfig({
      baseline: session.baseline,
      componentId: session.identity.id,
      next: validation.config,
    });
    if (result === 'updated' || result === 'unchanged') {
      close();
      return;
    }
    const messageByResult = {
      conflict: '组件配置已在编辑期间变化，请关闭后重新打开',
      missing: '组件已被删除，无法应用配置',
      readonly: '当前编辑器为只读模式，无法应用配置',
    } as const;
    setApplicationDiagnostics([{ message: messageByResult[result], path: [], severity: 'error' }]);
  }, [capabilityProfile, close, draft, registry, replaceComponentConfig, session]);

  const handleDiagnosticsChange = useCallback(
    (nextDiagnostics: readonly ComponentJsonEditorDiagnostic[]): void => {
      setEditorDiagnostics(nextDiagnostics);
    },
    [],
  );

  const applyPendingDragPosition = useCallback((): void => {
    dragAnimationFrameRef.current = null;
    const dialog = dialogContentRef.current;
    const dragSession = dragSessionRef.current;
    const pendingPosition = pendingDragPositionRef.current;
    if (dialog === null || dragSession === null || pendingPosition === null) return;
    dialog.style.transform = `translate3d(${pendingPosition.x - dragSession.x}px, ${pendingPosition.y - dragSession.y}px, 0)`;
  }, []);

  const handleDragStart = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest('button') !== null) return;
    const dialog = dialogContentRef.current;
    if (dialog === null) return;
    const bounds = dialog.getBoundingClientRect();
    const startPosition = clampDialogPosition({ x: bounds.x, y: bounds.y }, dialog);
    dragSessionRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      x: startPosition.x,
      y: startPosition.y,
    };
    floatingPositionRef.current = startPosition;
    pendingDragPositionRef.current = null;
    dialog.style.left = `${startPosition.x}px`;
    dialog.style.right = 'auto';
    dialog.style.top = `${startPosition.y}px`;
    dialog.style.transform = 'translate3d(0, 0, 0)';
    dialog.style.willChange = 'transform';
    setFloatingPosition(startPosition);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, []);

  const handleDragMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      const dragSession = dragSessionRef.current;
      const dialog = dialogContentRef.current;
      if (dragSession === null || dragSession.pointerId !== event.pointerId || dialog === null)
        return;
      pendingDragPositionRef.current = clampDialogPosition(
        {
          x: dragSession.x + event.clientX - dragSession.startClientX,
          y: dragSession.y + event.clientY - dragSession.startClientY,
        },
        dialog,
      );
      if (dragAnimationFrameRef.current === null) {
        dragAnimationFrameRef.current = window.requestAnimationFrame(applyPendingDragPosition);
      }
    },
    [applyPendingDragPosition],
  );

  const handleDragEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    const dragSession = dragSessionRef.current;
    if (dragSession?.pointerId !== event.pointerId) return;
    if (dragAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(dragAnimationFrameRef.current);
      dragAnimationFrameRef.current = null;
    }
    const finalPosition = pendingDragPositionRef.current ?? { x: dragSession.x, y: dragSession.y };
    const dialog = dialogContentRef.current;
    if (dialog !== null) {
      dialog.style.left = `${finalPosition.x}px`;
      dialog.style.right = 'auto';
      dialog.style.top = `${finalPosition.y}px`;
      dialog.style.transform = 'none';
      dialog.style.willChange = 'auto';
    }
    floatingPositionRef.current = finalPosition;
    pendingDragPositionRef.current = null;
    setFloatingPosition(finalPosition);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragSessionRef.current = null;
  }, []);

  const dialogTitle = readonly ? '查看组件 JSON' : '组件 JSON';
  const canRenderEditor = session !== null && registration !== undefined && schema !== undefined;

  return (
    <>
      <Dialog modal={false} open={open} onOpenChange={requestOpenChange}>
        <DialogContent
          ref={dialogContentRef}
          className="top-4 right-4 left-auto flex h-[min(72dvh,48rem)] w-[min(46rem,calc(100vw-2rem))] max-w-none flex-col translate-x-0 translate-y-0 gap-0 overflow-hidden p-0 sm:top-16 sm:right-6 sm:max-w-none"
          data-testid="component-json-editor-dialog"
          disableAnimation
          onInteractOutside={(event) => event.preventDefault()}
          showOverlay={false}
          style={
            floatingPosition === null
              ? undefined
              : {
                  left: floatingPosition.x,
                  right: 'auto',
                  top: floatingPosition.y,
                  transform: 'none',
                }
          }
        >
          <DialogHeader
            className="shrink-0 cursor-move touch-none select-none border-b border-border px-4 py-3 pr-12"
            data-testid="component-json-editor-dialog-drag-handle"
            onPointerCancel={handleDragEnd}
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
          >
            <DialogTitle className="flex min-w-0 items-center gap-2">
              <GripVertical aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <Braces className="size-4 shrink-0" />
              <span className="truncate">{dialogTitle}</span>
            </DialogTitle>
            {component !== undefined && (
              <p className="truncate text-xs text-muted-foreground">
                {component.name} · {component.type} · {component.id}
              </p>
            )}
          </DialogHeader>

          <div className="flex min-h-0 flex-1 p-3">
            {canRenderEditor ? (
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    正在加载编辑器
                  </div>
                }
              >
                <Editor
                  ariaLabel={`${dialogTitle}：${session.identity.type}`}
                  jsonSchema={schema}
                  modelUri={modelUri}
                  onChange={setDraft}
                  onDiagnosticsChange={handleDiagnosticsChange}
                  readOnly={readonly}
                  theme={theme}
                  value={draft}
                />
              </Suspense>
            ) : (
              <div
                className="flex h-full items-center justify-center text-sm text-muted-foreground"
                role="alert"
              >
                组件配置不可用
              </div>
            )}
          </div>

          <div
            aria-live="polite"
            className="min-h-0 shrink-0 border-t border-border px-4 py-2"
            data-testid="component-json-editor-diagnostics"
          >
            {diagnostics.length > 0 ? (
              <div className="flex max-h-20 flex-col gap-1 overflow-y-auto text-xs text-destructive">
                {diagnostics.slice(0, 3).map((diagnostic, index) => (
                  <p key={`${formatPath(diagnostic.path)}:${diagnostic.message}:${index}`}>
                    {formatPath(diagnostic.path)}：{diagnostic.message}
                  </p>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CircleAlert className="size-3.5" />
                <span>JSON 配置</span>
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/50 px-4 py-3">
            {!readonly && (
              <Button variant="outline" onClick={handleFormat} disabled={!canRenderEditor}>
                格式化
              </Button>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => requestOpenChange(false)}>
                {readonly ? '关闭' : '取消'}
              </Button>
              {!readonly && (
                <Button onClick={handleApply} disabled={!canRenderEditor}>
                  应用
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={discardConfirmationOpen} onOpenChange={setDiscardConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>放弃 JSON 修改？</AlertDialogTitle>
            <AlertDialogDescription>未应用的组件配置将被丢弃。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续编辑</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={close}>
              放弃修改
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
