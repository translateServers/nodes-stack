import { useMemo, useState } from 'react';
import {
  Download,
  Edit,
  Eye,
  Monitor,
  MoreHorizontal,
  Plus,
  Search,
  SearchX,
  Trash2,
} from 'lucide-react';
import type { ScreenProject } from '@nebula/shared/schemas';
import { useScreenProjects, useCreateScreenProject, useDeleteScreenProject } from '../hooks';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Spinner } from '@/components/ui/spinner';
import { formatRelativeTime } from '@/lib/format-relative-time';

/** 画布尺寸预设 */
const CANVAS_PRESETS = [
  { value: 'landscape', label: '1920 × 1080', description: '横屏', width: 1920, height: 1080 },
  { value: 'portrait', label: '1080 × 1920', description: '竖屏', width: 1080, height: 1920 },
  { value: '2k', label: '2560 × 1440', description: '2K', width: 2560, height: 1440 },
  { value: 'custom', label: '自定义', description: '手动输入宽高', width: 0, height: 0 },
] as const;

type CanvasPresetValue = (typeof CANVAS_PRESETS)[number]['value'];

/** 触发浏览器下载项目 JSON 文件 */
function exportProjectJson(project: ScreenProject) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.name}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ScreenListPage() {
  const { data: projects, isLoading } = useScreenProjects();
  const createMutation = useCreateScreenProject();
  const deleteMutation = useDeleteScreenProject();

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState<ScreenProject | null>(null);

  // 新建表单状态
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [preset, setPreset] = useState<CanvasPresetValue>('landscape');
  const [customWidth, setCustomWidth] = useState('');
  const [customHeight, setCustomHeight] = useState('');

  /** 按名称实时过滤项目 */
  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    const keyword = search.trim().toLowerCase();
    if (!keyword) return projects;
    return projects.filter((project) => project.name.toLowerCase().includes(keyword));
  }, [projects, search]);

  /** 重置新建表单 */
  const resetCreateForm = () => {
    setName('');
    setNameError('');
    setPreset('landscape');
    setCustomWidth('');
    setCustomHeight('');
  };

  const handleCreateOpenChange = (open: boolean) => {
    setCreateOpen(open);
    if (!open) resetCreateForm();
  };

  const handleCreate = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('请输入项目名称');
      return;
    }

    // 解析画布尺寸：预设直接取值，自定义校验正整数
    let width = 0;
    let height = 0;
    if (preset === 'custom') {
      width = Number(customWidth);
      height = Number(customHeight);
      // 自定义尺寸非法时直接忽略（按钮已按校验禁用，此处兜底 Enter 触发）
      if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
        return;
      }
    } else {
      const selected = CANVAS_PRESETS.find((item) => item.value === preset);
      if (!selected) return;
      width = selected.width;
      height = selected.height;
    }

    createMutation.mutate(
      {
        name: trimmedName,
        canvas: { width, height, backgroundColor: '#000000', scaleMode: 'fit' },
      },
      {
        onSuccess: (project) => {
          handleCreateOpenChange(false);
          window.open(`/screen/${project.id}`, '_blank');
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-6 text-muted-foreground/70" />
      </div>
    );
  }

  const customSizeInvalid =
    preset === 'custom' &&
    (!Number.isInteger(Number(customWidth)) ||
      Number(customWidth) <= 0 ||
      !Number.isInteger(Number(customHeight)) ||
      Number(customHeight) <= 0);

  return (
    <div className="mx-auto max-w-6xl p-6">
      {/* 页头：标题 + 搜索 + 新建按钮 */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">大屏设计器</h1>
          <p className="mt-1 text-sm text-muted-foreground">共 {projects?.length ?? 0} 个项目</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="搜索项目名称"
              className="w-56 pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            新建大屏
          </Button>
        </div>
      </div>

      {/* 项目卡片列表 */}
      {filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <Card
              key={project.id}
              className="group cursor-pointer gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md"
              onClick={() => window.open(`/screen/${project.id}`, '_blank')}
            >
              {/* 缩略图占位区：hover 浮现操作按钮 */}
              <div className="relative flex aspect-video items-center justify-center bg-gradient-to-br from-primary/10 to-muted">
                <Monitor className="size-10 text-muted-foreground/40" />
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/60 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`/screen/${project.id}`, '_blank');
                    }}
                  >
                    <Edit />
                    编辑
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`/screen-preview/${project.id}`, '_blank');
                    }}
                  >
                    <Eye />
                    预览
                  </Button>
                </div>
              </div>

              {/* 项目信息区 */}
              <div className="flex items-start justify-between gap-2 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-foreground">{project.name}</span>
                    <Badge variant={project.status === 'published' ? 'default' : 'secondary'}>
                      {project.status === 'published' ? '已发布' : '草稿'}
                    </Badge>
                  </div>
                  <div className="mt-1.5 text-xs text-muted-foreground">
                    {project.canvas.width} × {project.canvas.height} · {project.components.length}{' '}
                    个组件 · {formatRelativeTime(project.updatedAt)}
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="更多操作"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem
                      onClick={() => window.open(`/screen/${project.id}`, '_blank')}
                    >
                      <Edit />
                      编辑
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => window.open(`/screen-preview/${project.id}`, '_blank')}
                    >
                      <Eye />
                      预览
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportProjectJson(project)}>
                      <Download />
                      导出 JSON
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeletingProject(project)}
                    >
                      <Trash2 />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))}
        </div>
      ) : projects && projects.length > 0 ? (
        // 搜索无结果
        <Empty className="h-64 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchX />
            </EmptyMedia>
            <EmptyTitle>未找到匹配的项目</EmptyTitle>
            <EmptyDescription>没有找到名称包含「{search.trim()}」的大屏项目</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        // 无任何项目，引导创建
        <Empty className="h-64 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Monitor />
            </EmptyMedia>
            <EmptyTitle>暂无大屏项目</EmptyTitle>
            <EmptyDescription>创建你的第一个大屏项目，开始可视化搭建</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              新建大屏
            </Button>
          </EmptyContent>
        </Empty>
      )}

      {/* 新建大屏 Dialog */}
      <Dialog open={createOpen} onOpenChange={handleCreateOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建大屏</DialogTitle>
            <DialogDescription>填写项目名称并选择画布尺寸</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="screen-name">项目名称</Label>
              <Input
                id="screen-name"
                placeholder="输入大屏项目名称"
                value={name}
                aria-invalid={Boolean(nameError)}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                }}
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>

            <div className="grid gap-2">
              <Label>画布尺寸</Label>
              <RadioGroup
                value={preset}
                onValueChange={(value) => setPreset(value as CanvasPresetValue)}
                className="grid grid-cols-2 gap-2"
              >
                {CANVAS_PRESETS.map((item) => (
                  <Label
                    key={item.value}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 has-checked:border-primary has-checked:bg-primary/5"
                  >
                    <RadioGroupItem value={item.value} />
                    <span className="text-sm">
                      {item.label}
                      <span className="ml-1 text-xs text-muted-foreground">{item.description}</span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>

              {preset === 'custom' && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    placeholder="宽度"
                    value={customWidth}
                    aria-label="自定义宽度"
                    onChange={(e) => setCustomWidth(e.target.value)}
                  />
                  <span className="text-muted-foreground">×</span>
                  <Input
                    type="number"
                    min={1}
                    placeholder="高度"
                    value={customHeight}
                    aria-label="自定义高度"
                    onChange={(e) => setCustomHeight(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleCreate} disabled={createMutation.isPending || customSizeInvalid}>
              {createMutation.isPending ? <Spinner className="size-4" /> : <Plus />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 Dialog */}
      <AlertDialog
        open={deletingProject !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingProject(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除大屏项目</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除「{deletingProject?.name}」吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deletingProject) deleteMutation.mutate(deletingProject.id);
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
