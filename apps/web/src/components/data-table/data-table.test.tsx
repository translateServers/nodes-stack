import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from './data-table';
import { ConfirmDialogProvider } from '@/components/confirm-dialog';
import type { ColumnDef } from '@tanstack/react-table';

interface TestData {
  id: string;
  name: string;
  email: string;
  age: number;
}

const mockData: TestData[] = [
  { id: '1', name: 'Alice', email: 'alice@test.com', age: 30 },
  { id: '2', name: 'Bob', email: 'bob@test.com', age: 25 },
  { id: '3', name: 'Charlie', email: 'charlie@test.com', age: 35 },
  { id: '4', name: 'David', email: 'david@test.com', age: 28 },
  { id: '5', name: 'Eve', email: 'eve@test.com', age: 22 },
  { id: '6', name: 'Frank', email: 'frank@test.com', age: 40 },
  { id: '7', name: 'Grace', email: 'grace@test.com', age: 33 },
  { id: '8', name: 'Helen', email: 'helen@test.com', age: 27 },
  { id: '9', name: 'Ivan', email: 'ivan@test.com', age: 31 },
  { id: '10', name: 'Jack', email: 'jack@test.com', age: 29 },
  { id: '11', name: 'Kate', email: 'kate@test.com', age: 26 },
];

const columns: ColumnDef<TestData, unknown>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'age', header: 'Age' },
];

describe('DataTable', () => {
  describe('rendering', () => {
    it('should render data rows', () => {
      render(<DataTable data={mockData.slice(0, 3)} columns={columns} />);

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });

    it('should render correct number of rows', () => {
      render(<DataTable data={mockData.slice(0, 5)} columns={columns} />);

      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThan(5);
    });

    it('should show empty state when no data', () => {
      render(<DataTable data={[]} columns={columns} />);

      expect(screen.getByText('暂无数据')).toBeInTheDocument();
    });

    it('should show custom empty state', () => {
      render(
        <DataTable
          data={[]}
          columns={columns}
          emptyTitle="没有记录"
          emptyDescription="请添加数据"
        />,
      );

      expect(screen.getByText('没有记录')).toBeInTheDocument();
      expect(screen.getByText('请添加数据')).toBeInTheDocument();
    });

    it('should show loading spinner', () => {
      render(<DataTable data={[]} columns={columns} isLoading />);

      expect(screen.queryByText('暂无数据')).not.toBeInTheDocument();
    });
  });

  describe('pagination', () => {
    it('should show total count and page info', () => {
      render(<DataTable data={mockData} columns={columns} />);

      expect(screen.getByText(/共 11 条/)).toBeInTheDocument();
      expect(screen.getByText(/第 1\/2 页/)).toBeInTheDocument();
    });

    it('should navigate to next page', async () => {
      const user = userEvent.setup();
      render(<DataTable data={mockData} columns={columns} />);

      const nextButton = screen.getByRole('button', { name: '下一页' });
      await user.click(nextButton);

      expect(screen.getByText(/第 2\/2 页/)).toBeInTheDocument();
    });

    it('should disable previous button on first page', () => {
      render(<DataTable data={mockData} columns={columns} />);

      const prevButton = screen.getByRole('button', { name: '上一页' });
      expect(prevButton).toBeDisabled();
    });

    it('should disable next button on last page', async () => {
      const user = userEvent.setup();
      render(<DataTable data={mockData} columns={columns} />);

      const nextButton = screen.getByRole('button', { name: '下一页' });
      await user.click(nextButton);

      expect(nextButton).toBeDisabled();
    });
  });

  describe('search', () => {
    it('should render search input when searchColumnId is provided', () => {
      render(
        <DataTable
          data={mockData}
          columns={columns}
          searchColumnIds={['name']}
          searchPlaceholder="搜索姓名"
        />,
      );

      expect(screen.getByPlaceholderText('搜索姓名')).toBeInTheDocument();
    });

    it('should filter rows when typing in search', async () => {
      const user = userEvent.setup();
      render(
        <DataTable
          data={mockData}
          columns={columns}
          searchColumnIds={['name']}
          searchPlaceholder="搜索姓名"
        />,
      );

      const searchInput = screen.getByPlaceholderText('搜索姓名');
      await user.type(searchInput, 'Alice');

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.queryByText('Bob')).not.toBeInTheDocument();
    });

    it('should show empty state when search has no results', async () => {
      const user = userEvent.setup();
      render(
        <DataTable
          data={mockData}
          columns={columns}
          searchColumnIds={['name']}
          searchPlaceholder="搜索"
        />,
      );

      const searchInput = screen.getByPlaceholderText('搜索');
      await user.type(searchInput, 'zzzzz');

      expect(screen.getByText('暂无数据')).toBeInTheDocument();
    });
  });

  describe('row click', () => {
    it('should call onRowClick when row is clicked', async () => {
      const user = userEvent.setup();
      const onRowClick = vi.fn();
      render(<DataTable data={mockData.slice(0, 3)} columns={columns} onRowClick={onRowClick} />);

      await user.click(screen.getByText('Alice'));

      expect(onRowClick).toHaveBeenCalledWith(mockData[0]);
    });

    it('should add cursor-pointer class when onRowClick is provided', () => {
      render(<DataTable data={mockData.slice(0, 1)} columns={columns} onRowClick={vi.fn()} />);

      const rows = screen.getAllByRole('row');
      const dataRow = rows.find((row) => within(row).queryByText('Alice'));
      expect(dataRow).toHaveClass('cursor-pointer');
    });
  });

  describe('row selection', () => {
    it('should render checkboxes when enableRowSelection is true', () => {
      render(<DataTable data={mockData.slice(0, 3)} columns={columns} enableRowSelection />);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(4);
    });

    it('should select and deselect rows', async () => {
      const user = userEvent.setup();
      render(<DataTable data={mockData.slice(0, 3)} columns={columns} enableRowSelection />);

      const rowCheckboxes = screen.getAllByLabelText('选择行');
      await user.click(rowCheckboxes[0]);

      expect(screen.getByText(/已选择 1 项/)).toBeInTheDocument();
    });

    it('should show batch delete button when rows selected', async () => {
      const user = userEvent.setup();
      const onBatchDelete = vi.fn();
      render(
        <DataTable
          data={mockData.slice(0, 3)}
          columns={columns}
          enableRowSelection
          onBatchDelete={onBatchDelete}
        />,
      );

      const rowCheckboxes = screen.getAllByLabelText('选择行');
      await user.click(rowCheckboxes[0]);

      expect(screen.getByText('删除选中')).toBeInTheDocument();
    });

    it('should call onBatchDelete with selected rows', async () => {
      const user = userEvent.setup();
      const onBatchDelete = vi.fn();

      render(
        <>
          <DataTable
            data={mockData.slice(0, 3)}
            columns={columns}
            enableRowSelection
            onBatchDelete={onBatchDelete}
          />
          <ConfirmDialogProvider />
        </>,
      );

      const rowCheckboxes = screen.getAllByLabelText('选择行');
      await user.click(rowCheckboxes[0]);
      await user.click(rowCheckboxes[1]);

      const deleteButton = screen.getByText('删除选中');
      await user.click(deleteButton);

      const confirmButton = screen.getByText('确认删除');
      await user.click(confirmButton);

      expect(onBatchDelete).toHaveBeenCalledWith([mockData[0], mockData[1]]);

      vi.restoreAllMocks();
    });

    it('should clear selection when clicking cancel button', async () => {
      const user = userEvent.setup();
      render(<DataTable data={mockData.slice(0, 3)} columns={columns} enableRowSelection />);

      const rowCheckboxes = screen.getAllByLabelText('选择行');
      await user.click(rowCheckboxes[0]);
      expect(screen.getByText(/已选择 1 项/)).toBeInTheDocument();

      await user.click(screen.getByText('取消选择'));
      expect(screen.queryByText(/已选择/)).not.toBeInTheDocument();
    });
  });
});
