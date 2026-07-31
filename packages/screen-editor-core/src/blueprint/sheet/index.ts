/**
 * 蓝图 Sheet 容器模块入口（任务 4.7）
 *
 * 公开 API：
 * - BlueprintSheet：V1 全屏弹层（full-overlay）事件蓝图编辑器（保留供回滚）
 * - BlueprintSheetV2：V2 全屏弹层，采用"组件即节点"模型
 *   - 容器形态：fixed inset-0 z-50，带顶栏（h-12）
 *   - 数据流：editor-store.blueprint (V2) ↔ ReactFlow nodes/edges
 *   - 复用既有 primitives：nodes / edges / hooks / panels
 *
 * 与 docs/screen-designer-panels-architecture.md §7.4 一致。
 */

export { BlueprintSheet } from './blueprint-sheet';
export { BlueprintSheetV2 } from './blueprint-sheet-v2';
