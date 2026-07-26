import { createFileRoute } from '@tanstack/react-router';
import { ScreenBenchmark } from '@/features/screen/components/screen-benchmark';

/**
 * 画布拖拽基准测试页（顶层路由，无鉴权，无 _app 布局）。
 *
 * 路由：/screen-benchmark
 *
 * 用途：复现 Moveable 控制框显示/隐藏延迟问题，作为基准对比 light-chaser 的流畅度。
 * 与 /screen-preview/$id 的区别：本页使用静态预定义 JSON 数据，不依赖后端 API，
 * 也不需要鉴权，可独立部署访问。
 */
export const Route = createFileRoute('/screen-benchmark')({
  component: ScreenBenchmark,
});
