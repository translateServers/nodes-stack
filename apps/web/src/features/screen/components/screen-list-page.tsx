import { useState } from 'react';
import { Plus, Trash2, Eye, Edit } from 'lucide-react';
import {
  useScreenProjects,
  useCreateScreenProject,
  useDeleteScreenProject,
  usePublishScreenProject,
} from '../hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

export function ScreenListPage() {
  const { data: projects, isLoading } = useScreenProjects();
  const createMutation = useCreateScreenProject();
  const deleteMutation = useDeleteScreenProject();
  const publishMutation = usePublishScreenProject();
  const [newName, setNewName] = useState('');

  const handleCreate = () => {
    if (!newName.trim()) return;
    createMutation.mutate(
      { name: newName.trim() },
      {
        onSuccess: (project) => {
          setNewName('');
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

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">大屏设计器</h1>
      </div>

      {/* Create form */}
      <div className="mb-6 flex gap-2">
        <Input
          type="text"
          placeholder="输入大屏项目名称"
          className="flex-1"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate();
          }}
        />
        <Button onClick={handleCreate} disabled={!newName.trim() || createMutation.isPending}>
          {createMutation.isPending ? <Spinner className="size-4" /> : <Plus />}
          创建
        </Button>
      </div>

      {/* Project list */}
      {projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle>{project.name}</CardTitle>
                {project.description && (
                  <p className="text-xs text-muted-foreground">{project.description}</p>
                )}
                <CardAction>
                  <Badge variant={project.status === 'published' ? 'default' : 'secondary'}>
                    {project.status === 'published' ? '已发布' : '草稿'}
                  </Badge>
                </CardAction>
              </CardHeader>

              <CardContent>
                <div className="mb-3 text-xs text-muted-foreground/70">
                  {project.canvas.width} x {project.canvas.height} &middot;{' '}
                  {project.components.length} 个组件 &middot; {project.updatedAt}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    onClick={() => window.open(`/screen/${project.id}`, '_blank')}
                  >
                    <Edit />
                    编辑
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => window.open(`/screen-preview/${project.id}`, '_blank')}
                    aria-label="预览"
                  >
                    <Eye />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    onClick={() => {
                      if (confirm('确定删除此大屏项目？')) {
                        deleteMutation.mutate(project.id);
                      }
                    }}
                    aria-label="删除"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Empty className="h-48">
          <EmptyHeader>
            <EmptyTitle>暂无大屏项目</EmptyTitle>
            <EmptyDescription>请在上方输入名称后创建一个</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}
