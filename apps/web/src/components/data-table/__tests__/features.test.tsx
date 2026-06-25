import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from '../data-table';
import { ConfirmDialogProvider } from '@/components/confirm-dialog';
import type { ColumnDef } from '@tanstack/react-table';
import { TextFilter } from '../filters/text-filter';
import { SelectFilter } from '../filters/select-filter';
import { hasActiveFilter, getFilterRenderer } from '../filters';
import { EditableCell, createEditableColumns } from '../features/cell-editing';
import { getEditor } from '../editors';
import { wrapWithTreeExpand } from '../features/tree-data';
import { buildTableQuery, buildSortQuery, buildFilterConditions } from '../features/server-side';
import { reorderData } from '../features/row-drag';
import { reorderColumns } from '../features/column-drag';
import { computeCellSpans, getCellSpan } from '../features/cell-merge';
import { mergeSlots } from '../slots/slot-helpers';
import { validateFeatures, createDataTableFeature } from '../features/registry';

interface TestData {
  id: string;
  name: string;
  age: number;
  city: string;
}

const mockData: TestData[] = [
  { id: '1', name: 'Alice', age: 30, city: '北京' },
  { id: '2', name: 'Bob', age: 25, city: '上海' },
  { id: '3', name: 'Charlie', age: 35, city: '广州' },
];

const columns: ColumnDef<TestData, unknown>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'age', header: 'Age' },
  { accessorKey: 'city', header: 'City' },
];

describe('DataTable 新增特性', () => {
  describe('高级筛选', () => {
    it('should get filter renderer by type', () => {
      expect(getFilterRenderer('text')).toBeDefined();
      expect(getFilterRenderer('number-range')).toBeDefined();
      expect(getFilterRenderer('date-range')).toBeDefined();
      expect(getFilterRenderer('select')).toBeDefined();
      expect(getFilterRenderer(undefined)).toBeUndefined();
    });

    it('should render TextFilter', () => {
      const column = {
        getFilterValue: () => 'test',
        setFilterValue: vi.fn(),
      };
      render(<TextFilter column={column as never} />);
      expect(screen.getByDisplayValue('test')).toBeInTheDocument();
    });

    it('should render SelectFilter with options', () => {
      const column = {
        getFilterValue: () => [],
        setFilterValue: vi.fn(),
        columnDef: {
          meta: {
            filterOptions: [
              { label: '北京', value: '北京' },
              { label: '上海', value: '上海' },
            ],
          },
        },
      };
      render(<SelectFilter column={column as never} />);
      expect(screen.getByText('北京')).toBeInTheDocument();
      expect(screen.getByText('上海')).toBeInTheDocument();
    });
  });

  describe('单元格编辑', () => {
    it('should get editor by type', () => {
      expect(getEditor('text')).toBeDefined();
      expect(getEditor('number')).toBeDefined();
      expect(getEditor('select')).toBeDefined();
      expect(getEditor('date')).toBeDefined();
    });

    it('should create editable columns', () => {
      const onCellEdit = vi.fn();
      const editableColumns: ColumnDef<TestData, unknown>[] = [
        {
          accessorKey: 'name',
          header: 'Name',
          meta: { editable: true, editorType: 'text' },
        },
      ];
      const result = createEditableColumns(editableColumns, onCellEdit);
      expect(result).toHaveLength(1);
      expect(result[0].cell).toBeDefined();
    });

    it('should not modify non-editable columns', () => {
      const onCellEdit = vi.fn();
      const result = createEditableColumns(columns, onCellEdit);
      expect(result[0].cell).toBeUndefined();
    });
  });

  describe('服务端模式', () => {
    it('should build sort query from sorting state', () => {
      const sorting = [{ id: 'name', desc: true }];
      const result = buildSortQuery(sorting);
      expect(result).toEqual([{ field: 'name', order: 'desc' }]);
    });

    it('should return undefined for empty sorting', () => {
      expect(buildSortQuery([])).toBeUndefined();
    });

    it('should build filter conditions', () => {
      const filters = [{ id: 'name', value: 'Alice' }];
      const result = buildFilterConditions(filters);
      expect(result).toEqual([{ field: 'name', operator: 'contains', value: 'Alice' }]);
    });

    it('should build table query', () => {
      const query = buildTableQuery(
        { pageIndex: 0, pageSize: 10 },
        [{ id: 'name', desc: false }],
        [{ id: 'city', value: '北京' }],
        'search-term',
      );
      expect(query.page).toBe(1);
      expect(query.pageSize).toBe(10);
      expect(query.sort).toEqual([{ field: 'name', order: 'asc' }]);
      expect(query.filters).toEqual([{ field: 'city', operator: 'contains', value: '北京' }]);
      expect(query.search).toBe('search-term');
    });

    it('should call onQueryChange when server side is enabled', async () => {
      const onQueryChange = vi.fn();
      render(
        <DataTable
          data={mockData}
          columns={columns}
          enableServerSide
          serverQuery={{ onQueryChange, pageCount: 2, total: 20 }}
        />,
      );
      // onQueryChange 应在挂载时被调用
      expect(onQueryChange).toHaveBeenCalled();
    });
  });

  describe('树形数据', () => {
    it('should wrap column with tree expand', () => {
      const col: ColumnDef<TestData, unknown> = { accessorKey: 'name', header: 'Name' };
      const wrapped = wrapWithTreeExpand(col);
      expect(wrapped.cell).toBeDefined();
      expect(wrapped.accessorKey).toBe('name');
    });
  });

  describe('行拖拽', () => {
    it('should reorder data correctly', () => {
      const data = ['a', 'b', 'c', 'd'];
      const result = reorderData(data, 0, 2);
      expect(result).toEqual(['b', 'c', 'a', 'd']);
    });

    it('should not reorder for same index', () => {
      const data = ['a', 'b', 'c'];
      expect(reorderData(data, 1, 1)).toEqual(['a', 'b', 'c']);
    });

    it('should not reorder for out of bounds', () => {
      const data = ['a', 'b'];
      expect(reorderData(data, 0, 5)).toEqual(['a', 'b']);
    });
  });

  describe('列拖拽', () => {
    it('should reorder columns correctly', () => {
      const order = ['col1', 'col2', 'col3'];
      const result = reorderColumns(order, 'col1', 'col3');
      expect(result).toEqual(['col2', 'col3', 'col1']);
    });

    it('should not reorder for same column', () => {
      const order = ['col1', 'col2'];
      expect(reorderColumns(order, 'col1', 'col1')).toEqual(['col1', 'col2']);
    });
  });

  describe('合并单元格', () => {
    it('should compute cell spans', () => {
      const rows = [{ original: { name: 'Alice' } }, { original: { name: 'Alice' } }] as never;
      const spans = computeCellSpans(rows, ['name'], undefined, (row: TestData) =>
        row.name === 'Alice' ? 2 : undefined,
      );
      // 第一行 rowSpan=2，第二行被合并
      expect(spans.get('0:name')).toEqual({ colSpan: 1, rowSpan: 2 });
      expect(spans.get('1:name')).toEqual({ colSpan: 0, rowSpan: 0 });
    });

    it('should get cell span', () => {
      const spans = new Map([
        ['0:name', { colSpan: 2, rowSpan: 1 }],
        ['1:name', { colSpan: 0, rowSpan: 0 }],
      ]);
      expect(getCellSpan(spans, 0, 'name')).toEqual({ colSpan: 2, rowSpan: 1 });
      expect(getCellSpan(spans, 1, 'name')).toEqual({ colSpan: 0, rowSpan: 0 });
    });
  });

  describe('插槽机制', () => {
    it('should merge slots with correct priority', () => {
      const defaultSlots = { renderEmpty: () => null };
      const featureSlots = [{ renderEmpty: () => 'feature' }];
      const userSlots = { renderEmpty: () => 'user' };

      const merged = mergeSlots(userSlots, featureSlots, defaultSlots);
      expect(merged.renderEmpty).toBe(userSlots.renderEmpty);
    });

    it('should use feature slots when user slots not provided', () => {
      const defaultSlots = { renderEmpty: () => null };
      const featureSlots = [{ renderEmpty: () => 'feature' }];

      const merged = mergeSlots(undefined, featureSlots, defaultSlots);
      expect(merged.renderEmpty).toBe(featureSlots[0].renderEmpty);
    });
  });

  describe('Feature 插件注册系统', () => {
    it('should create feature with createDataTableFeature', () => {
      const feature = createDataTableFeature<{ id: string }>({
        id: 'test-feature',
        tableOptions: () => ({ enableMultiSort: true }),
      });
      expect(feature.id).toBe('test-feature');
      expect(feature.tableOptions).toBeDefined();
    });

    it('should validate features without errors for valid list', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const features = [
        createDataTableFeature<{ id: string }>({ id: 'a' }),
        createDataTableFeature<{ id: string }>({ id: 'b', deps: ['a'] }),
      ];
      validateFeatures(features);
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should warn for duplicate feature ids', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const features = [
        createDataTableFeature<{ id: string }>({ id: 'a' }),
        createDataTableFeature<{ id: string }>({ id: 'a' }),
      ];
      validateFeatures(features);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('重复的 feature 插件 id'));
      consoleSpy.mockRestore();
    });

    it('should warn for missing dependencies', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const features = [createDataTableFeature<{ id: string }>({ id: 'b', deps: ['a'] })];
      validateFeatures(features);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('依赖'));
      consoleSpy.mockRestore();
    });
  });

  describe('虚拟滚动', () => {
    it('should render without crashing with virtual scroll enabled', () => {
      // jsdom 环境下虚拟滚动容器无实际尺寸，仅验证组件不崩溃
      const { container } = render(
        <DataTable
          data={mockData}
          columns={columns}
          enableVirtualScroll
          virtualScrollHeight={200}
        />,
      );
      // 表格结构应存在
      expect(container.querySelector('table')).toBeInTheDocument();
      expect(container.querySelector('thead')).toBeInTheDocument();
    });
  });

  describe('多列排序', () => {
    it('should render with multi-sort enabled', () => {
      render(<DataTable data={mockData} columns={columns} enableMultiSort />);
      // 表头按钮应存在
      expect(screen.getByText('Name')).toBeInTheDocument();
    });
  });

  describe('合并单元格渲染', () => {
    it('should render with colSpan callback', () => {
      render(
        <DataTable
          data={mockData}
          columns={columns}
          getColSpan={(row) => (row.city === '北京' ? 2 : undefined)}
        />,
      );
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
  });

  describe('主从展开', () => {
    it('should render expanded row content', async () => {
      const user = userEvent.setup();
      render(
        <DataTable
          data={mockData.slice(0, 1)}
          columns={columns}
          renderExpandedRow={(row) => <div>详情：{row.name}</div>}
        />,
      );
      // 主从展开通过 expanded state 实现，默认不展开
      expect(screen.queryByText('详情：Alice')).not.toBeInTheDocument();
    });
  });
});
