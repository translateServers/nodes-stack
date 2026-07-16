import { useState } from 'react';
import { Plus, Trash2, Eye, Edit, Loader2 } from 'lucide-react';
import {
  useScreenProjects,
  useCreateScreenProject,
  useDeleteScreenProject,
  usePublishScreenProject,
} from '../hooks';

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
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">大屏设计器</h1>
      </div>

      {/* Create form */}
      <div className="mb-6 flex gap-2">
        <input
          type="text"
          placeholder="输入大屏项目名称"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate();
          }}
        />
        <button
          type="button"
          className="flex items-center gap-1 rounded bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
          onClick={handleCreate}
          disabled={!newName.trim() || createMutation.isPending}
        >
          {createMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          创建
        </button>
      </div>

      {/* Project list */}
      {projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className="rounded-lg border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{project.name}</h3>
                  {project.description && (
                    <p className="mt-0.5 text-xs text-gray-500">{project.description}</p>
                  )}
                </div>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs ${
                    project.status === 'published'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {project.status === 'published' ? '已发布' : '草稿'}
                </span>
              </div>

              <div className="mb-3 text-xs text-gray-400">
                {project.canvas.width} x {project.canvas.height} &middot;{' '}
                {project.components.length} 个组件 &middot; {project.updatedAt}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex flex-1 items-center justify-center gap-1 rounded bg-blue-50 px-2 py-1.5 text-xs text-blue-600 hover:bg-blue-100"
                  onClick={() => window.open(`/screen/${project.id}`, '_blank')}
                >
                  <Edit className="h-3 w-3" />
                  编辑
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center gap-1 rounded bg-green-50 px-2 py-1.5 text-xs text-green-600 hover:bg-green-100"
                  onClick={() => window.open(`/screen-preview/${project.id}`, '_blank')}
                >
                  <Eye className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center gap-1 rounded bg-red-50 px-2 py-1.5 text-xs text-red-600 hover:bg-red-100"
                  onClick={() => {
                    if (confirm('确定删除此大屏项目？')) {
                      deleteMutation.mutate(project.id);
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-48 items-center justify-center rounded-lg border-2 border-dashed text-gray-400">
          暂无大屏项目，请创建一个
        </div>
      )}
    </div>
  );
}
