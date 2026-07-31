/**
 * 全局变量管理面板（Task 9：画布设置入口）
 *
 * 在右侧属性面板「未选中组件」分支下渲染，与「画布设置」分区并列。
 *
 * 设计要点：
 * - 不接收 props：从 editor-store 直接读取 `project.globalVariables` 与三个 action
 *   （addGlobalVariable / updateGlobalVariable / removeGlobalVariable）
 * - 顶部「+ 添加」按钮放在 PanelSection.actions 位，触发添加 Dialog
 * - 列表行展示：名称 + 类型徽章 + 值摘要 + 编辑/删除按钮
 * - 编辑/添加统一走 GlobalVariableFormDialog（type 变化时动态切换字段）
 * - 删除走 AlertDialog 二次确认（与 QuickEventEditor 风格一致）
 *
 * 数据来源：editor-store 的 `project.globalVariables`（项目级）
 * 写回方式：editor-store 的三个 globalVariable actions（入历史栈，支持 undo/redo）
 */

import { useEffect, useId, useMemo, useState, type JSX } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { GlobalVariable, GlobalVariableType } from '@nebula/shared';
import { useScreenEditorStore } from '../stores/editor-store';
import { PanelSection } from './ui-primitives';
import { Button } from '@nebula/screen-editor-core/internal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@nebula/screen-editor-core/internal';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@nebula/screen-editor-core/internal';
import {
  cn,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nebula/screen-editor-core/internal';

// ===== 显示工具 =====

/**
 * 计算变量值摘要（用于列表行展示）。
 *
 * - static：将 value 序列化为字符串后截断 30 字符
 * - api：展示 apiConfig.url（截断 30 字符）
 * - computed：展示 expression 前 30 字符
 * 缺字段时返回占位符 '—'。
 */
function getVariableSummary(variable: GlobalVariable): string {
  switch (variable.type) {
    case 'static':
      return variable.value === undefined ? '—' : truncate(JSON.stringify(variable.value), 30);
    case 'api':
      return variable.apiConfig?.url ? truncate(variable.apiConfig.url, 30) : '—';
    case 'computed':
      return variable.expression ? truncate(variable.expression, 30) : '—';
    default:
      return '—';
  }
}

/** 截断字符串到 maxLen 长度，超出追加省略号 */
function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

/** 类型徽章样式映射：static/api/computed 三种颜色区分 */
const TYPE_BADGE_CLASS: Record<GlobalVariableType, string> = {
  static: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  api: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  computed: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
};

/** 类型显示名称 */
const TYPE_LABEL: Record<GlobalVariableType, string> = {
  static: '静态',
  api: 'API',
  computed: '表达式',
};

// ===== 表单状态 =====

/**
 * 表单内部状态。所有类型字段都保留在同一个 state 中，按当前 type 决定显示哪些字段。
 * - valueText：static 类型的 value 文本（textarea，支持 JSON 或字符串）
 * - url / method / refreshIntervalSec：api 类型的拉取配置（refreshInterval 单位秒）
 * - expression：computed 类型的表达式
 */
interface FormState {
  name: string;
  type: GlobalVariableType;
  valueText: string;
  url: string;
  method: 'GET' | 'POST';
  refreshIntervalSec: number;
  expression: string;
}

/** 从一个已存在的 GlobalVariable 派生表单初始状态（编辑场景） */
function deriveFormState(variable: GlobalVariable): FormState {
  return {
    name: variable.name,
    type: variable.type,
    valueText:
      variable.type === 'static' && variable.value !== undefined
        ? typeof variable.value === 'string'
          ? variable.value
          : JSON.stringify(variable.value)
        : '',
    url: variable.type === 'api' ? (variable.apiConfig?.url ?? '') : '',
    method: variable.type === 'api' ? (variable.apiConfig?.method ?? 'GET') : 'GET',
    refreshIntervalSec:
      variable.type === 'api' && variable.apiConfig
        ? Math.round(variable.apiConfig.refreshInterval / 1000)
        : 0,
    expression: variable.type === 'computed' ? (variable.expression ?? '') : '',
  };
}

/** 表单初始空状态（添加场景） */
const EMPTY_FORM_STATE: FormState = {
  name: '',
  type: 'static',
  valueText: '',
  url: '',
  method: 'GET',
  refreshIntervalSec: 0,
  expression: '',
};

/**
 * 将表单状态转换为提交给 store 的变量载荷（不含 id）。
 *
 * - static：尝试 JSON.parse valueText，失败则作为字符串字面量保留
 * - api：refreshInterval 由秒转换为毫秒（与 schema 一致）
 * - computed：保留 expression 字符串
 */
function buildVariablePayload(form: FormState): Omit<GlobalVariable, 'id'> {
  const base = { name: form.name.trim(), type: form.type };
  switch (form.type) {
    case 'static':
      return { ...base, value: parseStaticValue(form.valueText) };
    case 'api':
      return {
        ...base,
        apiConfig: {
          url: form.url.trim(),
          method: form.method,
          refreshInterval: Math.max(0, Math.round(form.refreshIntervalSec * 1000)),
        },
      };
    case 'computed':
      return { ...base, expression: form.expression };
  }
}

/** 解析 static value 输入：先尝试 JSON.parse，失败则作为字符串字面量 */
function parseStaticValue(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed === '') return '';
  try {
    return JSON.parse(trimmed);
  } catch {
    // 非 JSON 文本按字符串保留（去除首尾引号后整体作为字符串）
    return text;
  }
}

// ===== 主组件 =====

/**
 * 全局变量管理面板。
 *
 * 默认导出，无 props。订阅 editor-store 的 globalVariables 列表与三个 action。
 */
interface GlobalVariablesPanelProps {
  staticOnly?: boolean;
}

export default function GlobalVariablesPanel({
  staticOnly = false,
}: GlobalVariablesPanelProps): JSX.Element {
  const variables = useScreenEditorStore((s) => s.project?.globalVariables ?? []);
  const addGlobalVariable = useScreenEditorStore((s) => s.addGlobalVariable);
  const updateGlobalVariable = useScreenEditorStore((s) => s.updateGlobalVariable);
  const removeGlobalVariable = useScreenEditorStore((s) => s.removeGlobalVariable);

  // 添加/编辑 Dialog 状态：editingId 为 null 表示添加模式
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 删除确认 AlertDialog 状态：pendingDeleteId 为 null 表示关闭
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const editingVariable = useMemo(
    () => (editingId ? variables.find((v) => v.id === editingId) : undefined),
    [editingId, variables],
  );

  /** 打开添加对话框 */
  const handleOpenAdd = (): void => {
    setEditingId(null);
    setDialogOpen(true);
  };

  /** 打开编辑对话框 */
  const handleOpenEdit = (id: string): void => {
    setEditingId(id);
    setDialogOpen(true);
  };

  /** 提交表单：editingId 存在走 update，否则走 add */
  const handleSubmit = (form: FormState): void => {
    const payload = buildVariablePayload(staticOnly ? { ...form, type: 'static' } : form);
    if (editingId) {
      updateGlobalVariable(editingId, payload);
    } else {
      addGlobalVariable(payload);
    }
    setDialogOpen(false);
    setEditingId(null);
  };

  /** 确认删除 */
  const handleConfirmDelete = (): void => {
    if (pendingDeleteId) {
      removeGlobalVariable(pendingDeleteId);
    }
    setPendingDeleteId(null);
  };

  return (
    <PanelSection
      title="全局变量"
      testId="global-variables-section"
      actions={
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="添加全局变量"
          data-testid="global-variables-add"
          onClick={handleOpenAdd}
        >
          <Plus className="size-3.5" />
        </Button>
      }
    >
      {variables.length === 0 ? (
        <p
          className="py-3 text-center text-xs text-muted-foreground"
          data-testid="global-variables-empty"
        >
          暂无全局变量，点击右上角添加
        </p>
      ) : (
        <ul className="space-y-1.5" data-testid="global-variables-list">
          {variables.map((variable) => (
            <li
              key={variable.id}
              className="flex items-start gap-1.5 rounded border border-border bg-background px-2 py-1.5"
              data-testid="global-variables-item"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className="truncate text-xs font-medium"
                    data-testid="global-variables-item-name"
                  >
                    {variable.name}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded px-1 py-px text-[10px] font-medium',
                      TYPE_BADGE_CLASS[variable.type],
                    )}
                    data-testid="global-variables-item-type"
                  >
                    {TYPE_LABEL[variable.type]}
                  </span>
                </div>
                <div
                  className="mt-0.5 truncate text-[11px] text-muted-foreground"
                  data-testid="global-variables-item-summary"
                >
                  {getVariableSummary(variable)}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="编辑全局变量"
                data-testid="global-variables-edit"
                onClick={() => handleOpenEdit(variable.id)}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="删除全局变量"
                data-testid="global-variables-delete"
                onClick={() => setPendingDeleteId(variable.id)}
              >
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* 添加/编辑对话框 */}
      <GlobalVariableFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editingVariable}
        onSubmit={handleSubmit}
        staticOnly={staticOnly}
      />

      {/* 删除确认对话框 */}
      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除全局变量？</AlertDialogTitle>
            <AlertDialogDescription>
              将从项目中移除该全局变量，操作可通过历史栈撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="global-variables-delete-cancel">取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              data-testid="global-variables-delete-confirm"
              onClick={handleConfirmDelete}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PanelSection>
  );
}

// ===== 编辑/添加对话框 =====

interface GlobalVariableFormDialogProps {
  /** 受控 open 状态 */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 编辑场景下的初始变量；添加场景为 undefined */
  initial: GlobalVariable | undefined;
  /** 提交回调，参数为表单状态（由调用方决定走 add/update） */
  onSubmit: (form: FormState) => void;
  staticOnly: boolean;
}

/**
 * 添加/编辑全局变量对话框。
 *
 * 表单字段按 type 动态切换：
 * - 名称 + 类型 始终展示
 * - static → value textarea
 * - api → url / method / refreshInterval
 * - computed → expression textarea
 *
 * 每次 open 切换或 initial 变化时重置表单为初始状态。
 */
function GlobalVariableFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  staticOnly,
}: GlobalVariableFormDialogProps): JSX.Element {
  const initialForm = initial ? deriveFormState(initial) : EMPTY_FORM_STATE;
  const [form, setForm] = useState<FormState>(initialForm);
  // 实例级唯一 id 前缀，避免多实例下 Label htmlFor 与表单控件 id 冲突
  const fieldId = useId();
  const nameId = `${fieldId}-name`;
  const typeId = `${fieldId}-type`;
  const valueId = `${fieldId}-value`;
  const urlId = `${fieldId}-url`;
  const methodId = `${fieldId}-method`;
  const refreshId = `${fieldId}-refresh`;
  const expressionId = `${fieldId}-expression`;

  // 每次 open 切换或 initial 变化时重置表单，避免上次输入残留
  useEffect(() => {
    if (open) {
      setForm(initial ? deriveFormState(initial) : EMPTY_FORM_STATE);
    }
  }, [open, initial]);

  /** 通用字段更新 */
  const update = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /** 提交表单：名称必填，trim 后非空才提交 */
  const handleSubmit = (): void => {
    if (form.name.trim() === '') return;
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="global-variables-dialog">
        <DialogHeader>
          <DialogTitle>{initial ? '编辑全局变量' : '添加全局变量'}</DialogTitle>
          <DialogDescription>
            全局变量可在数据源参数与蓝图模板插值中通过 {'{{globalVars.xxx}}'} 引用
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* 名称（必填） */}
          <div className="space-y-1">
            <Label htmlFor={nameId}>名称</Label>
            <Input
              id={nameId}
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="如 apiBaseUrl"
              data-testid="global-variables-form-name"
            />
          </div>

          {!staticOnly && (
            <div className="space-y-1">
              <Label htmlFor={typeId}>类型</Label>
              <Select
                value={form.type}
                onValueChange={(v) => update('type', v as GlobalVariableType)}
              >
                <SelectTrigger
                  id={typeId}
                  className="w-full"
                  data-testid="global-variables-form-type"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="static" data-testid="global-variables-form-type-static">
                    静态
                  </SelectItem>
                  <SelectItem value="api" data-testid="global-variables-form-type-api">
                    API
                  </SelectItem>
                  <SelectItem value="computed" data-testid="global-variables-form-type-computed">
                    表达式
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 根据类型动态显示字段 */}
          {form.type === 'static' && (
            <div className="space-y-1" data-testid="global-variables-form-static-fields">
              <Label htmlFor={valueId}>值（支持 JSON 或字符串）</Label>
              <textarea
                id={valueId}
                className="min-h-[72px] w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                value={form.valueText}
                onChange={(e) => update('valueText', e.target.value)}
                placeholder='如 {"token": "abc"} 或纯文本'
                data-testid="global-variables-form-value"
              />
            </div>
          )}

          {!staticOnly && form.type === 'api' && (
            <div className="space-y-2" data-testid="global-variables-form-api-fields">
              <div className="space-y-1">
                <Label htmlFor={urlId}>URL</Label>
                <Input
                  id={urlId}
                  value={form.url}
                  onChange={(e) => update('url', e.target.value)}
                  placeholder="https://api.example.com/data"
                  data-testid="global-variables-form-url"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={methodId}>请求方法</Label>
                <Select
                  value={form.method}
                  onValueChange={(v) => update('method', v as 'GET' | 'POST')}
                >
                  <SelectTrigger
                    id={methodId}
                    className="w-full"
                    data-testid="global-variables-form-method"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET" data-testid="global-variables-form-method-get">
                      GET
                    </SelectItem>
                    <SelectItem value="POST" data-testid="global-variables-form-method-post">
                      POST
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor={refreshId}>刷新间隔（秒，0 = 不刷新）</Label>
                <Input
                  id={refreshId}
                  type="number"
                  min={0}
                  value={form.refreshIntervalSec}
                  onChange={(e) => update('refreshIntervalSec', Number(e.target.value) || 0)}
                  data-testid="global-variables-form-refresh"
                />
              </div>
            </div>
          )}

          {!staticOnly && form.type === 'computed' && (
            <div className="space-y-1" data-testid="global-variables-form-computed-fields">
              <Label htmlFor={expressionId}>表达式</Label>
              <textarea
                id={expressionId}
                className="min-h-[72px] w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                value={form.expression}
                onChange={(e) => update('expression', e.target.value)}
                placeholder="如 globalVars.a + globalVars.b"
                data-testid="global-variables-form-expression"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="global-variables-form-cancel"
          >
            取消
          </Button>
          <Button onClick={handleSubmit} data-testid="global-variables-form-submit">
            {initial ? '保存' : '添加'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
