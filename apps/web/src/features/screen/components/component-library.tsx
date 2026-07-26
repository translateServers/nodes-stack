import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, SearchX, Star } from 'lucide-react';
import { useScreenEditorStore } from '../stores/editor-store';
import type { ScreenComponent, ComponentDefinition } from '@nebula/shared';
import {
  COMPONENT_DEFINITIONS,
  createComponentInstance,
  getDefinitionByType,
  searchComponentDefinitions,
} from '../registry';
import { categoryLabel } from '../registry/category-meta';
import { getIconByName } from '../registry/icons';
import {
  getFavoriteComponents,
  toggleFavorite,
  type FavoriteEntry,
} from '../registry/favorite-components';
import {
  DEFAULT_RECENT_LIMIT,
  getRecentComponents,
  recordComponentUsage,
  type RecentComponentEntry,
} from '../registry/recent-components';
import { PanelSection } from './ui-primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// 静态常量，避免每次 render 重新计算
const CATEGORIES = [...new Set(COMPONENT_DEFINITIONS.map((d) => d.category))];

export function ComponentLibrary() {
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [recent, setRecent] = useState<RecentComponentEntry[]>([]);
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);

  // 分类折叠：通过 resetKey 强制 PanelSection 重新挂载以应用新的 defaultOpen
  const [resetKey, setResetKey] = useState(0);
  const [defaultOpen, setDefaultOpen] = useState(true);

  // 搜索 debounce：200ms 延迟，避免每次按键都触发搜索
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword), 200);
    return () => clearTimeout(timer);
  }, [keyword]);

  // 初次挂载、窗口聚焦、组件成功新增到画布时刷新最近使用
  useEffect(() => {
    const refresh = () => setRecent(getRecentComponents(DEFAULT_RECENT_LIMIT));
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('recent-components:updated', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('recent-components:updated', refresh);
    };
  }, []);

  // 收藏列表：初次挂载、窗口聚焦、收藏变更时刷新
  useEffect(() => {
    const refresh = () => setFavorites(getFavoriteComponents());
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('favorite-components:updated', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('favorite-components:updated', refresh);
    };
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, type: string) => {
    e.dataTransfer.setData('component-type', type);
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  const handleToggleFavorite = useCallback((type: string) => {
    toggleFavorite(type);
  }, []);

  const collapseAll = useCallback(() => {
    setDefaultOpen(false);
    setResetKey((k) => k + 1);
  }, []);

  const expandAll = useCallback(() => {
    setDefaultOpen(true);
    setResetKey((k) => k + 1);
  }, []);

  // 按名称 / 类型 / keywords 过滤（大小写不敏感，相关度排序）
  const filtered = useMemo(() => searchComponentDefinitions(debouncedKeyword), [debouncedKeyword]);

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

  // 收藏 type 集合（O(1) 查询），用于 ComponentLibraryItem 高亮已收藏项
  const favoriteTypes = useMemo(() => new Set(favorites.map((f) => f.type)), [favorites]);

  const isIdle = debouncedKeyword.trim() === '';
  const showRecent = isIdle && recent.length > 0;
  const showFavorites = isIdle && favorites.length > 0;
  const showCollapseButtons = isIdle && visibleCategories.length > 0;

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
          <p className="text-xs text-muted-foreground">
            未找到匹配「{debouncedKeyword.trim()}」的组件
          </p>
        </div>
      ) : (
        <>
          {showCollapseButtons && (
            <div className="flex items-center gap-1 px-3 py-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={collapseAll}
              >
                折叠全部
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={expandAll}
              >
                展开全部
              </Button>
            </div>
          )}

          {showFavorites && (
            <PanelSection title="收藏" testId="favorite-components-section">
              <FavoriteComponentsList
                favorites={favorites}
                onDragStart={handleDragStart}
                onToggleFavorite={handleToggleFavorite}
              />
            </PanelSection>
          )}

          {showRecent && (
            <PanelSection title="最近使用" testId="recent-components-section">
              <RecentComponentsList
                recent={recent}
                onDragStart={handleDragStart}
                favoriteTypes={favoriteTypes}
                onToggleFavorite={handleToggleFavorite}
              />
            </PanelSection>
          )}

          {visibleCategories.map((category) => (
            <PanelSection
              key={`${resetKey}-${category}`}
              title={categoryLabel(category)}
              collapsible
              defaultOpen={defaultOpen}
            >
              <div className="flex flex-col gap-1">
                {(filteredByCategory.get(category) ?? []).map((def) => (
                  <ComponentLibraryItem
                    key={def.type}
                    def={def}
                    onDragStart={handleDragStart}
                    isFavorite={favoriteTypes.has(def.type)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </div>
            </PanelSection>
          ))}
        </>
      )}
    </div>
  );
}

/** 单条组件库条目：图标 + 名称 + 收藏按钮 + badge */
function ComponentLibraryItem({
  def,
  onDragStart,
  isFavorite,
  onToggleFavorite,
}: {
  def: ComponentDefinition;
  onDragStart: (e: React.DragEvent, type: string) => void;
  isFavorite: boolean;
  onToggleFavorite: (type: string) => void;
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
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onToggleFavorite(def.type);
        }}
        aria-label="收藏"
        aria-pressed={isFavorite}
        className={cn(
          'ml-auto rounded p-1 transition-opacity',
          isFavorite
            ? 'opacity-100 text-amber-500'
            : 'text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100',
        )}
      >
        <Star className={cn('size-4', isFavorite && 'fill-current')} />
      </button>
      {def.badge === 'new' && (
        <span className="rounded bg-emerald-500/15 px-1 py-0.5 text-[10px] text-emerald-500">
          NEW
        </span>
      )}
      {def.badge === 'beta' && (
        <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[10px] text-amber-500">BETA</span>
      )}
    </div>
  );
}

/** 最近使用列表：复用 ComponentLibraryItem 的视觉风格 */
function RecentComponentsList({
  recent,
  onDragStart,
  favoriteTypes,
  onToggleFavorite,
}: {
  recent: RecentComponentEntry[];
  onDragStart: (e: React.DragEvent, type: string) => void;
  favoriteTypes: Set<string>;
  onToggleFavorite: (type: string) => void;
}) {
  // 只展示仍在注册表中的类型（避免历史脏数据）
  // 使用 getDefinitionByType（Map O(1)）替代 COMPONENT_DEFINITIONS.find（数组 O(N)）
  const validRecent = recent
    .map((entry) => {
      const def = getDefinitionByType(entry.type);
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
        <ComponentLibraryItem
          key={def.type}
          def={def}
          onDragStart={onDragStart}
          isFavorite={favoriteTypes.has(def.type)}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}

/** 收藏列表：复用 ComponentLibraryItem 的视觉风格 */
function FavoriteComponentsList({
  favorites,
  onDragStart,
  onToggleFavorite,
}: {
  favorites: FavoriteEntry[];
  onDragStart: (e: React.DragEvent, type: string) => void;
  onToggleFavorite: (type: string) => void;
}) {
  // 过滤掉已不存在的类型（历史脏数据），使用 getDefinitionByType（Map O(1)）
  const validFavorites = favorites
    .map((entry) => {
      const def = getDefinitionByType(entry.type);
      return def === undefined ? null : { entry, def };
    })
    .filter(
      (
        item: { entry: FavoriteEntry; def: ComponentDefinition } | null,
      ): item is { entry: FavoriteEntry; def: ComponentDefinition } => item !== null,
    );

  if (validFavorites.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      {validFavorites.map(({ def }) => (
        <ComponentLibraryItem
          key={def.type}
          def={def}
          onDragStart={onDragStart}
          isFavorite={true}
          onToggleFavorite={onToggleFavorite}
        />
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
        // 组件成功新增到画布后才记录最近使用
        recordComponentUsage(type);
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
