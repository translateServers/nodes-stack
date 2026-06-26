/**
 * Data Table Playground 主页面。
 * 侧边栏导航 + 多功能模块展示区，全面演示 DataTable 组件各项能力。
 */
import { useCallback, useEffect, useState } from 'react';
import { Table2, LayoutGrid, ArrowUpDown, ListOrdered, CheckSquare, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  BasicRenderingSection,
  SortingFilteringSection,
  PaginationSection,
  RowSelectionSection,
  CustomCellSection,
} from './playground-sections';

/** 侧边栏导航项配置 */
interface PlaygroundNavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const NAV_ITEMS: PlaygroundNavItem[] = [
  {
    id: 'section-basic',
    label: '基础渲染',
    icon: LayoutGrid,
    description: '最简配置数据展示',
  },
  {
    id: 'section-sort-filter',
    label: '排序与筛选',
    icon: ArrowUpDown,
    description: '多列排序 + 高级筛选',
  },
  {
    id: 'section-pagination',
    label: '分页控制',
    icon: ListOrdered,
    description: '翻页 / 条数 / 跳页',
  },
  {
    id: 'section-selection',
    label: '行选择',
    icon: CheckSquare,
    description: '单选与多选',
  },
  {
    id: 'section-custom-cell',
    label: '自定义渲染',
    icon: Palette,
    description: '自定义单元格内容',
  },
];

export default function DataTablePlaygroundPage() {
  const [activeSection, setActiveSection] = useState(NAV_ITEMS[0].id);

  /** 滚动至指定区块 */
  const scrollToSection = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  /** 监听滚动，高亮当前可见区块 */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // 选取当前最靠近视口顶部的可见区块
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
        }
      },
      {
        // 顶部偏移量考虑 sticky header 高度
        rootMargin: '-80px 0px -60% 0px',
        threshold: 0,
      },
    );

    NAV_ITEMS.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* 页面标题 */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Table2 className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Data Table Playground</h1>
          <p className="text-sm text-muted-foreground">
            全面体验 DataTable 组件的核心功能：基础渲染、排序筛选、分页、行选择与自定义单元格。
          </p>
        </div>
      </div>

      {/* 移动端横向导航 */}
      <nav className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <Button
              key={item.id}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              className="shrink-0"
              onClick={() => scrollToSection(item.id)}
            >
              <Icon className="mr-1.5 size-3.5" />
              {item.label}
            </Button>
          );
        })}
      </nav>

      {/* 桌面端：侧边栏 + 内容区 双栏布局 */}
      <div className="flex gap-6">
        {/* 固定侧边栏导航 */}
        <aside className="hidden w-52 shrink-0 lg:block">
          <nav className="sticky top-20 space-y-1">
            {NAV_ITEMS.map((item, index) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  className={cn(
                    'group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all',
                    isActive
                      ? 'bg-primary/8 text-primary font-medium ring-1 ring-primary/15'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5">
                      <Icon className="size-3.5" />
                      {item.label}
                    </span>
                    <span className="text-xs text-muted-foreground/70">{item.description}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* 内容区 */}
        <div className="min-w-0 flex-1 space-y-6">
          <BasicRenderingSection />
          <SortingFilteringSection />
          <PaginationSection />
          <RowSelectionSection />
          <CustomCellSection />
        </div>
      </div>
    </div>
  );
}
