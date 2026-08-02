import { Component, lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@nebula/screen-editor-core/internal';
import type { ComponentJsonEditorProps } from '@nebula/screen-editor-core';

interface MonacoEditorLoadBoundaryProps {
  readonly children: ReactNode;
  readonly onRetry: () => void;
}

interface MonacoEditorLoadBoundaryState {
  readonly hasError: boolean;
}

class MonacoEditorLoadBoundary extends Component<
  MonacoEditorLoadBoundaryProps,
  MonacoEditorLoadBoundaryState
> {
  public state: MonacoEditorLoadBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): MonacoEditorLoadBoundaryState {
    return { hasError: true };
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
          <p>编辑器加载失败</p>
          <Button type="button" variant="outline" size="sm" onClick={this.props.onRetry}>
            <RefreshCw data-icon="inline-start" />
            重试
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function ComponentJsonMonacoEditorLoader(props: ComponentJsonEditorProps) {
  const [attempt, setAttempt] = useState(0);
  const LazyMonacoEditor = useMemo(
    () =>
      lazy(() =>
        import('./component-json-monaco-editor').then((module) => ({
          default: module.ComponentJsonMonacoEditor,
        })),
      ),
    [attempt],
  );

  return (
    <MonacoEditorLoadBoundary key={attempt} onRetry={() => setAttempt((value) => value + 1)}>
      <Suspense
        fallback={
          <div className="flex h-full flex-1 items-center justify-center text-sm text-muted-foreground">
            正在加载编辑器
          </div>
        }
      >
        <LazyMonacoEditor {...props} />
      </Suspense>
    </MonacoEditorLoadBoundary>
  );
}
