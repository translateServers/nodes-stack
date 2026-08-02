import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScreenProject } from '@nebula/shared';
import { createLocalSnapshotAdapter } from './local-snapshot-adapter';

function createProject(id: string): ScreenProject {
  return {
    id,
    name: `项目 ${id}`,
    description: null,
    canvas: {
      width: 1920,
      height: 1080,
      backgroundColor: '#000000',
      scaleMode: 'fit',
    },
    components: [],
    globalVariables: [],
    status: 'draft',
    thumbnail: null,
    createdAt: '2026-07-30 10:00:00',
    updatedAt: '2026-07-30 10:00:00',
  };
}

describe('local snapshot host adapter', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates, lists and restores detached project snapshots', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_753_843_200_000);
    const adapter = createLocalSnapshotAdapter(localStorage);
    const project = createProject('screen-1');
    const createController = new AbortController();

    const summary = await adapter.create({
      projectId: project.id,
      revision: project.updatedAt,
      project,
      signal: createController.signal,
    });
    project.name = '调用方后续修改';

    const listed = await adapter.list({
      projectId: project.id,
      signal: new AbortController().signal,
    });
    expect(listed).toEqual([summary]);
    expect(summary).toMatchObject({
      id: '1753843200000',
      name: '项目 screen-1',
      componentCount: 0,
      canvasWidth: 1920,
      canvasHeight: 1080,
    });

    const restored = await adapter.restore({
      projectId: project.id,
      snapshotId: summary.id,
      revision: project.updatedAt,
      signal: new AbortController().signal,
    });
    restored.name = '修改恢复结果';
    const restoredAgain = await adapter.restore({
      projectId: project.id,
      snapshotId: summary.id,
      revision: project.updatedAt,
      signal: new AbortController().signal,
    });
    expect(restoredAgain.name).toBe('项目 screen-1');
  });

  it('isolates snapshot lists by project and supports remove and clear', async () => {
    let timestamp = 1_753_843_200_000;
    vi.spyOn(Date, 'now').mockImplementation(() => timestamp++);
    const adapter = createLocalSnapshotAdapter(localStorage);
    const first = createProject('screen-1');
    const second = createProject('screen-2');

    const firstSnapshot = await adapter.create({
      projectId: first.id,
      revision: first.updatedAt,
      project: first,
      signal: new AbortController().signal,
    });
    await adapter.create({
      projectId: second.id,
      revision: second.updatedAt,
      project: second,
      signal: new AbortController().signal,
    });

    await adapter.remove({
      projectId: first.id,
      snapshotId: firstSnapshot.id,
      signal: new AbortController().signal,
    });
    expect(
      await adapter.list({ projectId: first.id, signal: new AbortController().signal }),
    ).toEqual([]);
    expect(
      await adapter.list({ projectId: second.id, signal: new AbortController().signal }),
    ).toHaveLength(1);

    await adapter.clear({ projectId: second.id, signal: new AbortController().signal });
    expect(
      await adapter.list({ projectId: second.id, signal: new AbortController().signal }),
    ).toEqual([]);
  });

  it('keeps the newest 20 snapshots for a project', async () => {
    let timestamp = 1_753_843_200_000;
    vi.spyOn(Date, 'now').mockImplementation(() => timestamp++);
    const adapter = createLocalSnapshotAdapter(localStorage);
    const project = createProject('screen-1');

    for (let index = 0; index < 21; index += 1) {
      await adapter.create({
        projectId: project.id,
        revision: project.updatedAt,
        project: { ...project, name: `快照 ${index}` },
        signal: new AbortController().signal,
      });
    }

    const snapshots = await adapter.list({
      projectId: project.id,
      signal: new AbortController().signal,
    });
    expect(snapshots).toHaveLength(20);
    expect(snapshots[0]?.name).toBe('快照 20');
    expect(snapshots.at(-1)?.name).toBe('快照 1');
  });

  it('rejects aborted operations before touching storage', async () => {
    const adapter = createLocalSnapshotAdapter(localStorage);
    const controller = new AbortController();
    controller.abort();

    await expect(
      adapter.list({ projectId: 'screen-1', signal: controller.signal }),
    ).rejects.toThrow('aborted');
    expect(localStorage.length).toBe(0);
  });

  it('ignores corrupt entries and rejects restoring them', async () => {
    localStorage.setItem('screen-snapshot:screen-1:1753843200000', '{invalid json');
    const adapter = createLocalSnapshotAdapter(localStorage);

    expect(
      await adapter.list({ projectId: 'screen-1', signal: new AbortController().signal }),
    ).toEqual([]);
    await expect(
      adapter.restore({
        projectId: 'screen-1',
        snapshotId: '1753843200000',
        revision: 'revision-1',
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow('快照数据已损坏或被删除');
  });
});
