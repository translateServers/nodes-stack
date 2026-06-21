import { useCallback, useEffect, useRef, useState } from 'react';
import type { FUniver } from '@univerjs/presets';
import type { ICellCustomRender, ICellRenderContext } from '@univerjs/core';
import '@univerjs/sheets-data-validation/facade';
import { Button } from '@/components/ui/button';
import { Save, RefreshCw, Upload, Trash2, FileText, X, Paperclip } from 'lucide-react';
import { UniverContainer } from './univer-container';

// ─── 示例业务数据 ─────────────────────────────────────────
const SAMPLE_HEADERS = ['附件', '项目名称', '负责人', '部门', '状态', '优先级', '预算(万)', '备注'];
const SAMPLE_ROWS = [
  ['A001 智慧城市', '张三', '技术部', '进行中', '高', '500', ''],
  ['A002 数据中台', '李四', '研发部', '已完成', '中', '200', ''],
  ['A003 客户管理', '王五', '产品部', '待启动', '高', '350', ''],
  ['A004 移动办公', '赵六', '技术部', '进行中', '低', '120', ''],
  ['A005 AI 助手', '孙七', 'AI部', '规划中', '高', '800', ''],
  ['A006 供应链', '周八', '运营部', '已完成', '中', '450', ''],
  ['A007 财务报表', '吴九', '财务部', '进行中', '高', '180', ''],
  ['A008 人事系统', '郑十', 'HR部', '待启动', '低', '90', ''],
];

const STATUS_OPTIONS = ['进行中', '已完成', '待启动', '规划中'];
const PRIORITY_OPTIONS = ['高', '中', '低'];
const DEPARTMENT_OPTIONS = ['技术部', '研发部', '产品部', 'AI部', '运营部', '财务部', 'HR部'];

interface FileItem {
  id: string;
  name: string;
  size: string;
}

const INITIAL_FILES: Record<string, FileItem[]> = {
  '1': [
    { id: 'f1', name: '项目方案_v2.pdf', size: '2.3MB' },
    { id: 'f2', name: '需求文档.docx', size: '890KB' },
  ],
  '2': [{ id: 'f3', name: '验收报告.pdf', size: '1.1MB' }],
  '4': [
    { id: 'f4', name: '设计稿.fig', size: '15MB' },
    { id: 'f5', name: '测试报告.xlsx', size: '340KB' },
    { id: 'f6', name: '部署文档.md', size: '28KB' },
  ],
  '7': [{ id: 'f7', name: '预算明细.xlsx', size: '156KB' }],
};

function buildWorkbookData() {
  const cellData: Record<number, Record<number, { v: string | number }>> = {};

  cellData[0] = {};
  SAMPLE_HEADERS.forEach((h, col) => {
    cellData[0][col] = { v: h };
  });

  SAMPLE_ROWS.forEach((row, rowIdx) => {
    const rowNum = rowIdx + 1;
    cellData[rowNum] = {};
    cellData[rowNum][0] = { v: INITIAL_FILES[String(rowNum)] ? '📎' : '' };
    row.forEach((val, colIdx) => {
      cellData[rowNum][colIdx + 1] = { v: val };
    });
  });

  return {
    sheetOrder: ['sheet-01'],
    sheets: {
      'sheet-01': {
        id: 'sheet-01',
        name: '项目列表',
        cellData,
        rowCount: 50,
        columnCount: 20,
        columnData: {
          0: { w: 50 },
          1: { w: 160 },
          2: { w: 80 },
          3: { w: 100 },
          4: { w: 100 },
          5: { w: 80 },
          6: { w: 100 },
          7: { w: 200 },
        },
        defaultRowHeight: 28,
        defaultColumnWidth: 93,
      },
    },
  };
}

// ─── 文件气泡面板 ──────────────────────────────────────────
interface FilePopoverState {
  row: number;
  x: number;
  y: number;
}

function FilePopover({
  state,
  files,
  onClose,
  onUpload,
  onDelete,
}: {
  state: FilePopoverState;
  files: FileItem[];
  onClose: () => void;
  onUpload: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className="absolute z-50 w-64 rounded-lg border bg-popover p-0 shadow-lg"
      style={{ left: state.x, top: state.y }}
      data-file-popover
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">第 {state.row} 行</span>
          {files.length > 0 && (
            <span className="text-xs text-muted-foreground">{files.length} 个文件</span>
          )}
        </div>
        <button className="rounded p-0.5 hover:bg-muted" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {files.length > 0 ? (
        <div className="max-h-48 space-y-1 overflow-y-auto p-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="group flex items-center justify-between rounded px-2 py-1.5 hover:bg-muted"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm">{file.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{file.size}</span>
              </div>
              <button
                className="hidden rounded p-0.5 hover:bg-destructive/10 group-hover:block"
                onClick={() => onDelete(file.id)}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-3 py-3 text-center text-xs text-muted-foreground">暂无文件</p>
      )}

      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs"
          onClick={onUpload}
        >
          <Upload className="mr-1.5 h-3 w-3" />
          上传文件
        </Button>
      </div>
    </div>
  );
}

// ─── 📎 Canvas 自定义渲染器（基于官方 ICellCustomRender API）────
function createPaperclipRender(
  getFilesMap: () => Record<string, FileItem[]>,
  onCellClick: (row: number, clientX: number, clientY: number) => void,
): ICellCustomRender {
  const ICON_SIZE = 16;
  let isHovered = false;

  return {
    zIndex: 10,

    drawWith(ctx: CanvasRenderingContext2D, info: ICellRenderContext) {
      const { row, col, primaryWithCoord } = info;
      if (col !== 0 || row < 1) return;
      if ((getFilesMap()[String(row)]?.length ?? 0) === 0) return;

      // 只绘制 hover 高亮，📎 由单元格内容渲染
      if (isHovered) {
        const { startX, startY, endX, endY } = primaryWithCoord;
        const cx = startX + (endX - startX) / 2;
        const cy = startY + (endY - startY) / 2;

        ctx.save();
        ctx.fillStyle = 'rgba(139, 92, 246, 0.12)';
        ctx.beginPath();
        ctx.arc(cx, cy, ICON_SIZE * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    },

    isHit(position: { x: number; y: number }, info: ICellRenderContext) {
      const { row, col, primaryWithCoord } = info;
      if (col !== 0 || row < 1) return false;
      if ((getFilesMap()[String(row)]?.length ?? 0) === 0) return false;

      const { startX, startY, endX, endY } = primaryWithCoord;
      return (
        position.x >= startX && position.x <= endX && position.y >= startY && position.y <= endY
      );
    },

    onPointerDown(info: ICellRenderContext, evt: MouseEvent) {
      onCellClick(info.row, evt.clientX, evt.clientY);
    },

    onPointerEnter() {
      isHovered = true;
    },

    onPointerLeave() {
      isHovered = false;
    },
  };
}

// ─── 主页面组件 ─────────────────────────────────────────────
let fileIdCounter = 100;

export default function SheetPage() {
  const [univerAPI, setUniverAPI] = useState<FUniver | null>(null);
  const [popover, setPopover] = useState<FilePopoverState | null>(null);
  const [filesMap, setFilesMap] = useState<Record<string, FileItem[]>>(INITIAL_FILES);
  const workbookDataRef = useRef(buildWorkbookData());
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filesMapRef = useRef(filesMap);
  filesMapRef.current = filesMap;

  const handleReady = useCallback((api: FUniver) => {
    setUniverAPI(api);
  }, []);

  useEffect(() => {
    if (!univerAPI) return;

    // ── 注册 📎 Canvas 自定义渲染器 ──
    const sheetHooks = univerAPI.getSheetHooks();
    const paperclipRender = createPaperclipRender(
      () => filesMapRef.current,
      (row, clientX, clientY) => {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        setPopover({
          row,
          x: clientX - rect.left + 8,
          y: clientY - rect.top + 8,
        });
      },
    );
    const renderDisposable = sheetHooks.onCellRender([paperclipRender]);

    // 注册后延迟一帧重绘，确保工作簿已就绪
    requestAnimationFrame(() => {
      try {
        univerAPI.getActiveWorkbook()?.getActiveSheet()?.refreshCanvas();
      } catch {
        // 工作簿尚未就绪，忽略
      }
    });

    // ── 延迟设置下拉验证 ──
    const timer = setTimeout(() => {
      const worksheet = univerAPI.getActiveWorkbook()?.getActiveSheet();
      if (!worksheet) return;

      const setupDropdown = (colIndex: number, options: string[]) => {
        try {
          const range = worksheet.getRange(1, colIndex, SAMPLE_ROWS.length, 1);
          const rule = univerAPI
            .newDataValidation()
            .requireValueInList(options, false, true)
            .setOptions({ showDropDown: true, showErrorMessage: true })
            .setAllowInvalid(false)
            .build();
          range.setDataValidation(rule);
        } catch (e) {
          console.warn(`设置第${colIndex}列下拉失败:`, e);
        }
      };

      setupDropdown(3, DEPARTMENT_OPTIONS);
      setupDropdown(4, STATUS_OPTIONS);
      setupDropdown(5, PRIORITY_OPTIONS);
    }, 500);

    // ── 禁止编辑 A 列 ──
    univerAPI.addEvent(univerAPI.Event.BeforeSheetEditStart, (params) => {
      if (params.column === 0) {
        params.cancel = true;
      }
    });

    // ── 监听行插入事件 ──
    univerAPI.addEvent(univerAPI.Event.SheetSkeletonChanged, (params) => {
      if (params.payload?.id === 'sheet.mutation.insert-row') {
        console.log('新行已插入，A 列留空等待上传');
      }
    });

    // ── 点击表格其他区域关闭气泡 ──
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-file-popover]')) return;
      setTimeout(() => {
        setPopover((prev) => {
          const cell = univerAPI.getActiveWorkbook()?.getActiveSheet()?.getActiveCell();
          if (cell && cell.getColumn() !== 0) return null;
          return prev;
        });
      }, 100);
    };

    const container = containerRef.current;
    container?.addEventListener('click', handleClickOutside);

    return () => {
      clearTimeout(timer);
      renderDisposable?.dispose();
      container?.removeEventListener('click', handleClickOutside);
    };
  }, [univerAPI]);

  // 文件变化时重绘 canvas 以更新 📎 图标
  useEffect(() => {
    if (!univerAPI) return;
    try {
      univerAPI.getActiveWorkbook()?.getActiveSheet()?.refreshCanvas();
    } catch {
      // ignore
    }
  }, [univerAPI, filesMap]);

  // ── 上传文件 ──
  const handleUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !popover) return;

      const rowKey = String(popover.row);
      const newFile: FileItem = {
        id: `f${++fileIdCounter}`,
        name: file.name,
        size:
          file.size > 1048576
            ? `${(file.size / 1048576).toFixed(1)}MB`
            : `${Math.round(file.size / 1024)}KB`,
      };

      setFilesMap((prev) => ({
        ...prev,
        [rowKey]: [...(prev[rowKey] ?? []), newFile],
      }));

      // 上传后在 A 列写入 📎
      try {
        univerAPI
          ?.getActiveWorkbook()
          ?.getActiveSheet()
          ?.getRange(popover.row, 0)
          .setValueForCell('📎');
      } catch {
        // ignore
      }

      e.target.value = '';
    },
    [popover, univerAPI],
  );

  // ── 删除文件 ──
  const handleDelete = useCallback(
    (fileId: string) => {
      if (!popover) return;
      const rowKey = String(popover.row);

      setFilesMap((prev) => {
        const current = prev[rowKey] ?? [];
        const next = current.filter((f) => f.id !== fileId);

        if (next.length === 0) {
          try {
            univerAPI
              ?.getActiveWorkbook()
              ?.getActiveSheet()
              ?.getRange(popover.row, 0)
              .setValueForCell('');
          } catch {
            // ignore
          }
        }

        return next.length > 0 ? { ...prev, [rowKey]: next } : { ...prev };
      });
    },
    [popover, univerAPI],
  );

  const handleSave = useCallback(() => {
    if (!univerAPI) return;
    const workbook = univerAPI.getActiveWorkbook();
    if (!workbook) return;
    const data = workbook.save();
    console.log('Workbook data saved:', data);
  }, [univerAPI]);

  const popoverFiles = popover ? (filesMap[String(popover.row)] ?? []) : [];

  return (
    <div className="-mx-4 -mt-4 flex h-[calc(100vh-8rem)] flex-col lg:-mx-6 lg:-mt-6">
      <div className="flex shrink-0 items-center justify-between border-b bg-background px-4 py-2">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">项目管理表</h1>
          <span className="text-xs text-muted-foreground">
            点击 📎 管理文件 | 状态/优先级/部门列支持下拉选择
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            刷新
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Save className="mr-1.5 h-4 w-4" />
            保存
          </Button>
        </div>
      </div>

      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
        <UniverContainer initialData={workbookDataRef.current} onReady={handleReady} />
        {popover && (
          <FilePopover
            state={popover}
            files={popoverFiles}
            onClose={() => setPopover(null)}
            onUpload={handleUpload}
            onDelete={handleDelete}
          />
        )}
      </div>
    </div>
  );
}
