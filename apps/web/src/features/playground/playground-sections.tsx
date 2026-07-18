/**
 * Data Table Playground 各功能模块演示组件。
 * 每个组件独立展示 DataTable 的一项核心能力。
 */
import { useMemo, useState } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { toast } from 'sonner';
import { DataTable, DataTableColumnHeader, filterFns } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Pencil, Eye, UserCircle2 } from 'lucide-react';
import {
  employees,
  employeesBasic,
  DEPARTMENTS,
  STATUS_CONFIG,
  formatSalary,
  formatDate,
  type Employee,
} from './mock-data';

const columnHelper = createColumnHelper<Employee>();

// ============================================================
// 模块一：基础数据渲染
// ============================================================

/** 基础数据渲染 — 最简配置，展示数据绑定与默认样式 */
export function BasicRenderingSection() {
  const columns = useMemo(
    () => [
      columnHelper.accessor('id', { header: '工号', size: 120 }),
      columnHelper.accessor('name', { header: '姓名', size: 120 }),
      columnHelper.accessor('department', { header: '部门', size: 120 }),
      columnHelper.accessor('position', { header: '职位', size: 160 }),
      columnHelper.accessor('email', { header: '邮箱', size: 220 }),
    ],
    [],
  );

  return (
    <Card id="section-basic">
      <CardHeader>
        <CardTitle>基础数据渲染</CardTitle>
        <CardDescription>
          最简配置，仅传入 data 与 columns，展示 DataTable 的默认渲染能力与样式。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable data={employeesBasic} columns={columns} getRowId={(row) => row.id} />
      </CardContent>
    </Card>
  );
}

// ============================================================
// 模块二：列排序与筛选
// ============================================================

/** 列排序与筛选 — 多列排序 + 高级筛选（文本/数字范围/日期范围/多选） */
export function SortingFilteringSection() {
  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: ({ column, table }) => (
          <DataTableColumnHeader column={column} table={table} title="姓名" />
        ),
        size: 120,
        meta: { filterType: 'text' },
      }),
      columnHelper.accessor('department', {
        header: ({ column, table }) => (
          <DataTableColumnHeader column={column} table={table} title="部门" />
        ),
        size: 120,
        meta: {
          filterType: 'select',
          filterOptions: [...DEPARTMENTS],
        },
        filterFn: filterFns.select,
      }),
      columnHelper.accessor('position', {
        header: ({ column, table }) => (
          <DataTableColumnHeader column={column} table={table} title="职位" />
        ),
        size: 160,
      }),
      columnHelper.accessor('salary', {
        header: ({ column, table }) => (
          <DataTableColumnHeader column={column} table={table} title="薪资" />
        ),
        size: 130,
        cell: (info) => formatSalary(info.getValue()),
        meta: { filterType: 'number-range' },
        filterFn: filterFns.numberRange,
      }),
      columnHelper.accessor('joinDate', {
        header: ({ column, table }) => (
          <DataTableColumnHeader column={column} table={table} title="入职日期" />
        ),
        size: 140,
        cell: (info) => formatDate(info.getValue()),
        meta: { filterType: 'date-range' },
        filterFn: filterFns.dateRange,
      }),
    ],
    [],
  );

  return (
    <Card id="section-sort-filter">
      <CardHeader>
        <CardTitle>列排序与筛选</CardTitle>
        <CardDescription>
          点击列头进行升降序排序（Shift+点击启用多列排序）；列头菜单内提供高级筛选：
          文本搜索、部门多选、薪资区间、入职日期范围。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          data={employees}
          columns={columns}
          getRowId={(row) => row.id}
          searchPlaceholder="搜索姓名..."
          searchColumnIds={['name']}
          enableMultiSort
        />
      </CardContent>
    </Card>
  );
}

// ============================================================
// 模块三：分页控制
// ============================================================

/** 分页控制 — 大数据集分页，展示页码导航、每页条数切换、跳页 */
export function PaginationSection() {
  const columns = useMemo(
    () => [
      columnHelper.accessor('id', { header: '工号', size: 120 }),
      columnHelper.accessor('name', { header: '姓名', size: 120 }),
      columnHelper.accessor('department', { header: '部门', size: 120 }),
      columnHelper.accessor('position', { header: '职位', size: 160 }),
      columnHelper.accessor('level', { header: '职级', size: 100 }),
      columnHelper.accessor('salary', {
        header: '薪资',
        size: 130,
        cell: (info) => formatSalary(info.getValue()),
      }),
    ],
    [],
  );

  return (
    <Card id="section-pagination">
      <CardHeader>
        <CardTitle>分页控制</CardTitle>
        <CardDescription>
          共 {employees.length} 条数据，默认每页 10 条。可切换每页条数、翻页或直接跳转至指定页。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          data={employees}
          columns={columns}
          getRowId={(row) => row.id}
          searchPlaceholder="搜索姓名..."
          searchColumnIds={['name']}
        />
      </CardContent>
    </Card>
  );
}

// ============================================================
// 模块四：行选择（单选/多选）
// ============================================================

/** 行选择 — 多选（复选框 + 批量操作）与单选（点击行高亮） */
export function RowSelectionSection() {
  // --- 多选模式 ---
  const multiColumns = useMemo(
    () => [
      columnHelper.accessor('name', { header: '姓名', size: 120 }),
      columnHelper.accessor('department', { header: '部门', size: 120 }),
      columnHelper.accessor('position', { header: '职位', size: 160 }),
      columnHelper.accessor('status', {
        header: '状态',
        size: 100,
        cell: (info) => {
          const cfg = STATUS_CONFIG[info.getValue()];
          return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
        },
      }),
    ],
    [],
  );

  const handleBatchDelete = (selected: Employee[]) => {
    toast.success(`已模拟删除 ${selected.length} 名员工（playground 不执行真实删除）`);
  };

  // --- 单选模式 ---
  const [selectedRow, setSelectedRow] = useState<Employee | null>(null);

  const singleColumns = useMemo(
    () => [
      columnHelper.accessor('name', { header: '姓名', size: 120 }),
      columnHelper.accessor('department', { header: '部门', size: 120 }),
      columnHelper.accessor('position', { header: '职位', size: 160 }),
      columnHelper.accessor('level', { header: '职级', size: 100 }),
    ],
    [],
  );

  return (
    <Card id="section-selection">
      <CardHeader>
        <CardTitle>行选择（单选 / 多选）</CardTitle>
        <CardDescription>
          上方为多选模式：通过复选框选择多行，支持批量删除；下方为单选模式：点击行选中并查看详情。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 多选 */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">多选模式</h4>
          <DataTable
            data={employeesBasic}
            columns={multiColumns}
            getRowId={(row) => row.id}
            enableRowSelection
            onBatchDelete={handleBatchDelete}
            batchDeleteConfirmMessage="确定要删除选中的员工吗？（playground 仅模拟）"
            searchPlaceholder="搜索姓名..."
            searchColumnIds={['name']}
          />
        </div>

        {/* 单选 */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">单选模式</h4>
          <DataTable
            data={employeesBasic}
            columns={singleColumns}
            getRowId={(row) => row.id}
            onRowClick={(row) => setSelectedRow(row)}
          />
          {selectedRow && (
            <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <UserCircle2 className="size-8 text-primary" />
              <div className="text-sm">
                <span className="font-medium">已选中：</span>
                {selectedRow.name}（{selectedRow.department} · {selectedRow.position} ·{' '}
                {selectedRow.level}）
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => setSelectedRow(null)}
              >
                取消选择
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 模块五：自定义单元格渲染
// ============================================================

/** 自定义单元格渲染 — 状态 Badge、绩效进度条、薪资格式化、头像、操作按钮 */
export function CustomCellSection() {
  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: '员工',
        size: 180,
        cell: (info) => (
          <div className="flex items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
              {info.getValue().charAt(0)}
            </div>
            <div className="flex flex-col">
              <span className="font-medium">{info.getValue()}</span>
              <span className="text-xs text-muted-foreground">{info.row.original.id}</span>
            </div>
          </div>
        ),
      }),
      columnHelper.accessor('department', {
        header: '部门',
        size: 110,
        cell: (info) => <Badge variant="outline">{info.getValue()}</Badge>,
      }),
      columnHelper.accessor('status', {
        header: '状态',
        size: 100,
        cell: (info) => {
          const cfg = STATUS_CONFIG[info.getValue()];
          return (
            <Badge variant={cfg.variant} className="gap-1">
              <span
                className={`size-1.5 rounded-full ${
                  info.getValue() === 'active'
                    ? 'bg-green-500'
                    : info.getValue() === 'leave'
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                }`}
              />
              {cfg.label}
            </Badge>
          );
        },
      }),
      columnHelper.accessor('performance', {
        header: '绩效',
        size: 160,
        cell: (info) => {
          const val = info.getValue();
          const color = val >= 85 ? 'bg-green-500' : val >= 70 ? 'bg-blue-500' : 'bg-orange-500';
          return (
            <div className="flex items-center gap-2">
              <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                <div className={`h-full ${color} transition-all`} style={{ width: `${val}%` }} />
              </div>
              <span className="text-xs font-medium tabular-nums">{val}</span>
            </div>
          );
        },
      }),
      columnHelper.accessor('salary', {
        header: '薪资',
        size: 130,
        cell: (info) => (
          <span className="font-medium tabular-nums text-foreground">
            {formatSalary(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor('joinDate', {
        header: '入职日期',
        size: 140,
        cell: (info) => (
          <span className="text-muted-foreground">{formatDate(info.getValue())}</span>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: '操作',
        size: 130,
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => toast.info(`查看员工：${row.original.name}`)}
            >
              <Eye className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => toast.info(`编辑员工：${row.original.name}`)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-destructive hover:text-destructive"
              onClick={() => toast.info(`删除员工：${row.original.name}（仅模拟）`)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ),
      }),
    ],
    [],
  );

  return (
    <Card id="section-custom-cell">
      <CardHeader>
        <CardTitle>自定义单元格渲染</CardTitle>
        <CardDescription>
          通过 cell
          渲染函数自定义单元格内容：员工头像、部门标签、状态指示灯、绩效进度条、薪资格式化与操作按钮。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          data={employeesBasic}
          columns={columns}
          getRowId={(row) => row.id}
          searchPlaceholder="搜索姓名..."
          searchColumnIds={['name']}
          enableColumnResize
        />
      </CardContent>
    </Card>
  );
}
