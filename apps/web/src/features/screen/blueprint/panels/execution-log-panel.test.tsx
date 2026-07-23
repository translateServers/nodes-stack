/**
 * ExecutionLogPanel 组件测试（任务 8.3）
 *
 * 验证点（对应 tasks.md 8.3 验证要求）：
 * - 组件测试覆盖日志顺序
 * - 失败标记（红色 + 可点击定位）
 * - 点击定位节点
 * - 模拟中 / trigger 不存在 / 拒绝 / 空态
 * - 清空日志按钮
 * - 深度截断告警
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ExecutionLogPanel } from './execution-log-panel';
import type { ActionResult, RuleExecutionLog } from '../runtime/types';

// ===== 公共构造器 =====

function makeSuccess(nodeId: string, durationMs = 10): ActionResult {
  return { kind: 'success', nodeId, durationMs };
}

function makeSkipped(nodeId: string, reason: string): ActionResult {
  return { kind: 'skipped', nodeId, reason };
}

function makeFailure(nodeId: string, error: string, durationMs = 20): ActionResult {
  return { kind: 'failure', nodeId, error, durationMs };
}

function makeLog(
  triggerNodeId: string,
  results: ActionResult[],
  truncated = false,
): RuleExecutionLog {
  return { triggerNodeId, results, truncated };
}

const baseProps = {
  isSimulating: false,
  triggerNotFound: false,
  onLocateNode: vi.fn(),
};

describe('ExecutionLogPanel（任务 8.3）', () => {
  describe('状态优先级', () => {
    it('模拟中：显示"正在执行..."', () => {
      render(<ExecutionLogPanel {...baseProps} executionLogs={[]} isSimulating={true} />);

      expect(screen.getByTestId('blueprint-execution-log-loading')).toBeInTheDocument();
      expect(screen.getByText('正在执行模拟...')).toBeInTheDocument();
    });

    it('trigger 不存在：显示"未找到触发器节点"', () => {
      render(<ExecutionLogPanel {...baseProps} executionLogs={[]} triggerNotFound={true} />);

      expect(screen.getByTestId('blueprint-execution-log-trigger-not-found')).toBeInTheDocument();
      expect(screen.getByText('未找到触发器节点')).toBeInTheDocument();
    });

    it('因 error 级诊断被拒绝：显示拒绝原因', () => {
      render(
        <ExecutionLogPanel
          {...baseProps}
          executionLogs={[]}
          refusalReason="触发器未选择触发组件"
        />,
      );

      expect(screen.getByTestId('blueprint-execution-log-refused')).toBeInTheDocument();
      expect(
        screen.getByText('触发器存在错误级诊断，已拒绝执行：触发器未选择触发组件'),
      ).toBeInTheDocument();
    });

    it('无执行日志：显示"尚未执行模拟"空态', () => {
      render(<ExecutionLogPanel {...baseProps} executionLogs={[]} />);

      expect(screen.getByTestId('blueprint-execution-log-empty')).toBeInTheDocument();
      expect(screen.getByText('尚未执行模拟')).toBeInTheDocument();
    });

    it('模拟中状态优先级高于 trigger 不存在', () => {
      render(
        <ExecutionLogPanel
          {...baseProps}
          executionLogs={[]}
          isSimulating={true}
          triggerNotFound={true}
        />,
      );

      // 模拟中状态优先
      expect(screen.getByTestId('blueprint-execution-log-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('blueprint-execution-log-trigger-not-found')).toBeNull();
    });
  });

  describe('日志顺序与计数', () => {
    it('按 results 顺序展示动作结果', () => {
      const log = makeLog('t1', [
        makeSuccess('a1', 5),
        makeSkipped('a2', '组件不存在'),
        makeFailure('a3', '请求失败', 30),
      ]);

      render(<ExecutionLogPanel {...baseProps} executionLogs={[log]} />);

      const items = screen.getAllByTestId('execution-log-item');
      expect(items).toHaveLength(3);

      // 顺序保持
      expect(items[0]).toHaveAttribute('data-result-kind', 'success');
      expect(items[0]).toHaveAttribute('data-node-id', 'a1');
      expect(items[1]).toHaveAttribute('data-result-kind', 'skipped');
      expect(items[1]).toHaveAttribute('data-node-id', 'a2');
      expect(items[2]).toHaveAttribute('data-result-kind', 'failure');
      expect(items[2]).toHaveAttribute('data-node-id', 'a3');
    });

    it('标题栏显示触发器 ID 与计数', () => {
      const log = makeLog('trigger-x', [
        makeSuccess('a1'),
        makeSuccess('a2'),
        makeSkipped('a3', 'dangling'),
        makeFailure('a4', 'error'),
      ]);

      render(<ExecutionLogPanel {...baseProps} executionLogs={[log]} />);

      expect(screen.getByTestId('execution-log-trigger')).toHaveTextContent('触发器：trigger-x');
      expect(screen.getByTestId('execution-log-count-success')).toHaveTextContent('2 成功');
      expect(screen.getByTestId('execution-log-count-skipped')).toHaveTextContent('1 跳过');
      expect(screen.getByTestId('execution-log-count-failure')).toHaveTextContent('1 失败');
    });

    it('无失败时不显示失败计数', () => {
      const log = makeLog('t1', [makeSuccess('a1'), makeSuccess('a2')]);

      render(<ExecutionLogPanel {...baseProps} executionLogs={[log]} />);

      expect(screen.getByTestId('execution-log-count-success')).toHaveTextContent('2 成功');
      expect(screen.queryByTestId('execution-log-count-skipped')).toBeNull();
      expect(screen.queryByTestId('execution-log-count-failure')).toBeNull();
    });

    it('取最新一次日志（executionLogs[0]）渲染', () => {
      const oldLog = makeLog('t-old', [makeSuccess('a-old')]);
      const newLog = makeLog('t-new', [makeSuccess('a-new')]);

      render(<ExecutionLogPanel {...baseProps} executionLogs={[newLog, oldLog]} />);

      // 显示最新日志的触发器
      expect(screen.getByTestId('execution-log-trigger')).toHaveTextContent('触发器：t-new');
      const items = screen.getAllByTestId('execution-log-item');
      expect(items).toHaveLength(1);
      expect(items[0]).toHaveAttribute('data-node-id', 'a-new');
    });
  });

  describe('失败动作红色标记与点击定位', () => {
    it('失败动作显示错误信息与耗时', () => {
      const log = makeLog('t1', [makeFailure('a-fail', '请求超时', 150)]);

      render(<ExecutionLogPanel {...baseProps} executionLogs={[log]} />);

      expect(screen.getByTestId('execution-log-error-0')).toHaveTextContent('请求超时 · 150ms');
    });

    it('点击失败动作触发 onLocateNode', () => {
      const onLocateNode = vi.fn();
      const log = makeLog('t1', [makeSuccess('a1'), makeFailure('a-fail', '请求失败', 50)]);

      render(
        <ExecutionLogPanel {...baseProps} executionLogs={[log]} onLocateNode={onLocateNode} />,
      );

      const items = screen.getAllByTestId('execution-log-item');
      // 点击失败行（第 2 个）
      fireEvent.click(items[1]);

      expect(onLocateNode).toHaveBeenCalledTimes(1);
      expect(onLocateNode).toHaveBeenCalledWith('a-fail');
    });

    it('点击 success 行不触发 onLocateNode', () => {
      const onLocateNode = vi.fn();
      const log = makeLog('t1', [makeSuccess('a1')]);

      render(
        <ExecutionLogPanel {...baseProps} executionLogs={[log]} onLocateNode={onLocateNode} />,
      );

      const items = screen.getAllByTestId('execution-log-item');
      fireEvent.click(items[0]);

      expect(onLocateNode).not.toHaveBeenCalled();
    });

    it('点击 skipped 行不触发 onLocateNode', () => {
      const onLocateNode = vi.fn();
      const log = makeLog('t1', [makeSkipped('a1', '组件不存在')]);

      render(
        <ExecutionLogPanel {...baseProps} executionLogs={[log]} onLocateNode={onLocateNode} />,
      );

      const items = screen.getAllByTestId('execution-log-item');
      fireEvent.click(items[0]);

      expect(onLocateNode).not.toHaveBeenCalled();
    });

    it('skipped 动作显示跳过原因', () => {
      const log = makeLog('t1', [makeSkipped('a-skip', '组件不存在（dangling）')]);

      render(<ExecutionLogPanel {...baseProps} executionLogs={[log]} />);

      expect(screen.getByTestId('execution-log-skip-reason-0')).toHaveTextContent(
        '组件不存在（dangling）',
      );
    });

    it('success 动作显示耗时', () => {
      const log = makeLog('t1', [makeSuccess('a-ok', 42)]);

      render(<ExecutionLogPanel {...baseProps} executionLogs={[log]} />);

      // 耗时显示在节点行
      expect(screen.getByText('42ms')).toBeInTheDocument();
    });
  });

  describe('清空按钮与深度截断', () => {
    it('提供 onClear 时显示清空按钮并触发', () => {
      const onClear = vi.fn();
      const log = makeLog('t1', [makeSuccess('a1')]);

      render(<ExecutionLogPanel {...baseProps} executionLogs={[log]} onClear={onClear} />);

      const clearBtn = screen.getByTestId('execution-log-clear');
      fireEvent.click(clearBtn);

      expect(onClear).toHaveBeenCalledTimes(1);
    });

    it('未提供 onClear 时不显示清空按钮', () => {
      const log = makeLog('t1', [makeSuccess('a1')]);

      render(<ExecutionLogPanel {...baseProps} executionLogs={[log]} />);

      expect(screen.queryByTestId('execution-log-clear')).toBeNull();
    });

    it('深度截断时末尾显示截断告警', () => {
      const log = makeLog('t1', [makeSuccess('a1')], true);

      render(<ExecutionLogPanel {...baseProps} executionLogs={[log]} />);

      expect(screen.getByTestId('execution-log-truncated')).toBeInTheDocument();
      expect(screen.getByText('执行因深度超过上限被截断')).toBeInTheDocument();
    });

    it('未截断时不显示截断告警', () => {
      const log = makeLog('t1', [makeSuccess('a1')], false);

      render(<ExecutionLogPanel {...baseProps} executionLogs={[log]} />);

      expect(screen.queryByTestId('execution-log-truncated')).toBeNull();
    });
  });

  describe('边界情况', () => {
    it('空 results 列表：仅显示标题栏与触发器', () => {
      const log = makeLog('t1', []);

      render(<ExecutionLogPanel {...baseProps} executionLogs={[log]} />);

      expect(screen.getByTestId('blueprint-execution-log-panel')).toBeInTheDocument();
      expect(screen.queryAllByTestId('execution-log-item')).toHaveLength(0);
      // 无计数显示
      expect(screen.queryByTestId('execution-log-count-success')).toBeNull();
    });

    it('多结果混合：所有状态正确渲染', () => {
      const log = makeLog('multi-trigger', [
        makeSuccess('a1', 5),
        makeSkipped('a2', '组件 dangling'),
        makeSuccess('a3', 8),
        makeFailure('a4', '请求失败', 100),
        makeSuccess('a5', 3),
      ]);

      render(<ExecutionLogPanel {...baseProps} executionLogs={[log]} />);

      const items = screen.getAllByTestId('execution-log-item');
      expect(items).toHaveLength(5);

      // 计数
      expect(screen.getByTestId('execution-log-count-success')).toHaveTextContent('3 成功');
      expect(screen.getByTestId('execution-log-count-skipped')).toHaveTextContent('1 跳过');
      expect(screen.getByTestId('execution-log-count-failure')).toHaveTextContent('1 失败');

      // 状态标签
      expect(screen.getByTestId('execution-log-status-0')).toHaveTextContent('成功');
      expect(screen.getByTestId('execution-log-status-1')).toHaveTextContent('跳过');
      expect(screen.getByTestId('execution-log-status-2')).toHaveTextContent('成功');
      expect(screen.getByTestId('execution-log-status-3')).toHaveTextContent('失败');
      expect(screen.getByTestId('execution-log-status-4')).toHaveTextContent('成功');
    });
  });
});
