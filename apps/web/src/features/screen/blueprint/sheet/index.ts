/**
 * 蓝图 Sheet 容器模块入口（任务 4.7）
 *
 * 公开 API：
 * - BlueprintSheet：全屏弹层（full-overlay）事件蓝图编辑器
 *   - 容器形态：fixed inset-0 z-50，带顶栏（h-12）
 *   - 数据流：editor-store.blueprint ↔ ReactFlow nodes/edges
 *   - 复用既有 primitives：nodes / edges / hooks / panels
 *
 * 与 docs/screen-designer-panels-architecture.md §7.4 一致。
 */

export { BlueprintSheet } from './blueprint-sheet';
