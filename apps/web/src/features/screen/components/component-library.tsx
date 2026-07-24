import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, SearchX } from 'lucide-react';
import { useScreenEditorStore } from '../stores/editor-store';
import type { ScreenComponent, ComponentDefinition } from '@nebula/shared';
import {
  CATEGORY_LABELS,
  COMPONENT_DEFINITIONS,
  createComponentInstance,
  searchComponentDefinitions,
} from '../registry';
import { getIconByName } from '../registry/icons';
import {
  getRecentComponents,
  recordComponentUsage,
  type RecentComponentEntry,
} from '../registry/recent-components';
import { PanelSection } from './ui-primitives';
import { Input } from '@/components/ui/input';

const RECENT_LIMIT = 5;
// 静态常量，避免每次 render 重新计算
const CATEGORIES = [...new Set(COMPONENT_DEFINITIONS.map((d) => d.category))];

/**
 * 拖拽 / 点击创建后记录最近使用。
 * 使用 useCallback 包装避免每次 render 创建新闭包；调用方按需使用。
 */
function useRecordUsage() {
  return useCallback((type: string) => {
    recordComponentUsage(type);
  }, []);
}

export function ComponentLibrary() {
  const [keyword, setKeyword] = useState('');
  const [recent, setRecent] = useState<RecentComponentEntry[]>([]);

  // 初次挂载与窗口聚焦时刷新最近使用（localStorage 可能在其他 tab 更新）
  useEffect(() => {
    const refresh = () => setRecent(getRecentComponents(RECENT_LIMIT));
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const recordUsage = useRecordUsage();

  const handleDragStart = useCallback(
    (e: React.DragEvent, type: string) => {
      e.dataTransfer.setData('component-type', type);
      e.dataTransfer.effectAllowed = 'copy';
      // 拖拽创建时记录使用（drop 成功才入画布，此处乐观记录避免 drop 失败时漏记；
      // 即使失败也只是最近使用多一条，不影响功能）
      recordUsage(type);
      setRecent(getRecentComponents(RECENT_LIMIT));
    },
    [recordUsage],
  );

  // 按名称 / 类型 / keywords 过滤（大小写不敏感）
  const filtered = useMemo(() => searchComponentDefinitions(keyword), [keyword]);

  /**
   * js-combine-iterations + js-set-map-lookups：原实现为
   * `CATEGORIES.filter(category => filtered.some(d => d.category === category))`，
   * 嵌套 O(N×M)；下方渲染又对每个 category 重新 `filtered.filter(d => d.category === category)`，
   * 总计 O(N×M) + O(C×N)。改为单次遍历按 category 分组为 Map，后续渲染直接从 Map 取值，
   * 总复杂度降为 O(N)。
   */
  const filteredByCategory = useMemo(() => {
    const map = new Map<string, ComponentDefinition[]>();
    for (const d of filtered) {
      const list = map.get(d.category);
      if (list) {
        list.push(d);
      } else {
        map.set(d.category, [d]);
      }
    }
    return map;
  }, [filtered]);

  // visibleCategories 直接从 Map 的 key 迭代获取，避免 O(N×M) 嵌套查找
  const visibleCategories = useMemo(
    () => CATEGORIES.filter((category) => filteredByCategory.has(category)),
    [filteredByCategory],
  );

  // 关键词为空时显示最近使用区，关键词非空时不显示（搜索结果优先）
  const showRecent = keyword.trim() === '' && recent.length > 0;

  return (
    <div className="flex flex-col">
      {/* 搜索框 */}
      <div className="relative p-2">
        <Search className="pointer-events-none absolute top-1/2 left-4.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="搜索组件..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="h-7 pl-7 text-xs"
          aria-label="搜索组件"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
          <SearchX className="size-6 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">未找到匹配「{keyword.trim()}」的组件</p>
        </div>
      ) : (
        <>
          {showRecent && (
            <PanelSection title="最近使用" testId="recent-components-section">
              <RecentComponentsList recent={recent} onDragStart={handleDragStart} />
            </PanelSection>
          )}
          {visibleCategories.map((category) => (
            <PanelSection key={category} title={CATEGORY_LABELS[category] ?? category}>
              <div className="flex flex-col gap-1">
                {(filteredByCategory.get(category) ?? []).map((def) => (
                  <ComponentLibraryItem key={def.type} def={def} onDragStart={handleDragStart} />
                ))}
              </div>
            </PanelSection>
          ))}
        </>
      )}
    </div>
  );
}

/** 单条组件库条目：图标 + 名称 + 描述 tooltip */
function ComponentLibraryItem({
  def,
  onDragStart,
}: {
  def: ComponentDefinition;
  onDragStart: (e: React.DragEvent, type: string) => void;
}) {
  const Icon = getIconByName(def.icon);
  const tooltip =
    def.description !== undefined
      ? `${def.name} · ${def.description}`
      : `拖拽「${def.name}」到画布`;
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, def.type)}
      title={tooltip}
      className="group flex cursor-grab items-center gap-2.5 rounded-md border border-transparent px-2 py-1.5 transition-colors hover:border-primary/30 hover:bg-accent active:cursor-grabbing"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted transition-colors group-hover:bg-primary/10">
        <Icon className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
      </span>
      <span className="truncate text-xs text-foreground">{def.name}</span>
      {def.badge === 'new' && (
        <span className="ml-auto rounded bg-emerald-500/15 px-1 py-0.5 text-[10px] text-emerald-500">
          NEW
        </span>
      )}
      {def.badge === 'beta' && (
        <span className="ml-auto rounded bg-amber-500/15 px-1 py-0.5 text-[10px] text-amber-500">
          BETA
        </span>
      )}
    </div>
  );
}

/** 最近使用列表：复用 ComponentLibraryItem 的视觉风格 */
function RecentComponentsList({
  recent,
  onDragStart,
}: {
  recent: RecentComponentEntry[];
  onDragStart: (e: React.DragEvent, type: string) => void;
}) {
  // 只展示仍在注册表中的类型（避免历史脏数据）
  const validRecent = recent
    .map((entry) => {
      const def = COMPONENT_DEFINITIONS.find((d) => d.type === entry.type);
      return def === undefined ? null : { entry, def };
    })
    .filter(
      (
        item: { entry: RecentComponentEntry; def: ComponentDefinition } | null,
      ): item is {
        entry: RecentComponentEntry;
        def: ComponentDefinition;
      } => item !== null,
    );

  if (validRecent.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      {validRecent.map(({ def }) => (
        <ComponentLibraryItem key={def.type} def={def} onDragStart={onDragStart} />
      ))}
    </div>
  );
}

export function useCanvasDrop() {
  const project = useScreenEditorStore((s) => s.project);
  const addComponent = useScreenEditorStore((s) => s.addComponent);
  const canvasScale = useScreenEditorStore((s) => s.canvasScale);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('component-type');
      if (!type || !project) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left) / canvasScale);
      const y = Math.round((e.clientY - rect.top) / canvasScale);
      const maxZ = project.components.reduce(
        (max: number, c: ScreenComponent) => Math.max(max, c.zIndex),
        0,
      );

      const instance = createComponentInstance(type, x, y, maxZ + 1, project.components);
      if (instance) {
        addComponent(instance);
      }
    },
    [project, addComponent, canvasScale],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  return { handleDrop, handleDragOver };
}
