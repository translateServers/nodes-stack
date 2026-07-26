import { useEffect, useRef } from 'react';
import { useScreenEditorStore } from '../stores/editor-store';
import { useToolStateMachine } from '../hooks/use-tool-state-machine';
import { useInteractionStateMachine } from '../hooks/use-interaction-state-machine';
import { useEditorSession } from '../hooks/use-editor-session';
import { ScreenCanvas } from './screen-canvas';
import { benchmarkProject } from '../benchmark-data';
import { FpsMonitor } from './fps-monitor';

/**
 * 画布拖拽基准测试页（无鉴权，无编辑器外壳）。
 *
 * 用途：复现 Moveable 控制框显示/隐藏延迟问题，作为基准对比 light-chaser 的流畅度。
 * 与完整 ScreenEditor 的差异：
 * - 无登录鉴权、无 Router 守卫（顶层路由，匿名访问）
 * - 无工具栏 / 侧边栏 / 属性面板 / 上下文菜单 / 标尺 / 参考线 / 状态栏
 * - 无保存 / 发布 / 历史栈 / 撤销重做 / 拖拽创建 / 文本编辑等业务逻辑
 * - 无 TanStack Query 数据获取（直接用 import 的静态 JSON）
 * - 仅保留：toolStateMachine + interactionStateMachine + editorSession + ScreenCanvas
 *
 * 路由：/screen-benchmark（顶层路由，无 _app 布局，无鉴权）
 *
 * 测试方法：
 * 1. 访问 /screen-benchmark
 * 2. 鼠标点击组件 → 观察 Moveable 控制框是否立即显示
 * 3. 鼠标点击空白 → 观察控制框是否立即隐藏
 * 4. 鼠标按下未选中组件并拖拽 → 观察控制框是否同步出现
 * 5. 与 light-chaser 项目对照手感
 */
export function ScreenBenchmark() {
  const loadProject = useScreenEditorStore((s) => s.loadProject);
  const setCanvasScaleAndOffset = useScreenEditorStore((s) => s.setCanvasScaleAndOffset);
  const project = useScreenEditorStore((s) => s.project);

  const toolStateMachine = useToolStateMachine();
  const interactionStateMachine = useInteractionStateMachine();
  const editorSession = useEditorSession({
    toolStateMachine,
    interactionStateMachine,
  });

  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // 一次性加载预定义项目
  useEffect(() => {
    loadProject(benchmarkProject);
  }, [loadProject]);

  // 初次进入时 fit-to-screen（复用 ScreenEditor 的 fit 逻辑）
  useEffect(() => {
    if (!project || !canvasContainerRef.current) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const canvas = project.canvas;
    const scaleX = (rect.width - 60) / canvas.width;
    const scaleY = (rect.height - 60) / canvas.height;
    const fitScale = Math.min(scaleX, scaleY, 1);
    const offsetX = (rect.width - canvas.width * fitScale) / 2;
    const offsetY = (rect.height - canvas.height * fitScale) / 2;
    setCanvasScaleAndOffset(fitScale, { x: offsetX, y: offsetY });
  }, [project, setCanvasScaleAndOffset]);

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      <header className="flex h-10 items-center justify-between border-b px-4 text-xs text-muted-foreground">
        <span>画布拖拽基准测试页（无鉴权 · 无编辑器外壳 · 仅画布 + 组件）</span>
        <FpsMonitor />
      </header>
      <div
        ref={canvasContainerRef}
        className="relative flex-1 overflow-hidden bg-muted/40"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        <div className="absolute inset-0" style={{ top: 20, left: 20 }}>
          <ScreenCanvas editorSession={editorSession} />
        </div>
      </div>
    </div>
  );
}
