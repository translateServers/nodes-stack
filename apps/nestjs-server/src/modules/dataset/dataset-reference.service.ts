import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { BizCode } from '@/common/enums/biz-code.enum';
import { BusinessException } from '@/common/exceptions/business.exception';
import type { ScreenComponent } from '@nebula/shared/schemas';

/**
 * 数据集引用索引服务
 *
 * 设计依据：`docs/specs/dataset-management/data-model.md` §4.2
 *
 * 组件对 datasetId 的引用埋在 ScreenProject.components JSON 字符串内部，
 * 无法靠外键发现。新增 DatasetReference 索引表用于：
 * - 列表页"引用数"展示
 * - 删除/归档前校验引用
 *
 * 写入时机：项目保存（PUT /screen/:id）时由后端解析 components JSON，
 * 提取 dataSource.type === 'dataset' 的绑定，事务内重建该项目的引用索引（先删后插）。
 */
@Injectable()
export class DatasetReferenceService {
  private readonly logger = new Logger(DatasetReferenceService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 重建项目的数据集引用索引
   *
   * 在事务内执行：先删除该项目的所有引用，再从 components 解析并插入新引用。
   * 应在 screen.service.updateProject 成功后调用。
   *
   * @param projectId 项目 ID
   * @param components 项目组件列表（已解析的 ScreenComponent[]）
   */
  async rebuildReferences(projectId: string, components: ScreenComponent[]): Promise<void> {
    // 提取所有 dataSource.type === 'dataset' 的引用
    const references: { datasetId: string; componentId: string }[] = [];
    for (const component of components) {
      const ds = component.dataSource;
      if (ds && ds.type === 'dataset' && ds.datasetId) {
        references.push({
          datasetId: ds.datasetId,
          componentId: component.id,
        });
      }
    }

    // 使用 $transaction 回调形式（而非数组形式）：
    // 1. 数组形式要求 PrismaPromise<any>[]，类型推断在条件分支下不稳定
    // 2. 回调形式可保证先删后插在同一事务内原子完成
    // 注意：不使用 createMany 的 skipDuplicates 选项，因为 SQLite 不支持该选项；
    // 先 deleteMany 再 createMany 已保证无重复（@@unique 约束兜底）
    await this.prisma.$transaction(async (tx) => {
      await tx.datasetReference.deleteMany({ where: { projectId } });
      if (references.length > 0) {
        await tx.datasetReference.createMany({
          data: references.map((r) => ({
            datasetId: r.datasetId,
            projectId,
            componentId: r.componentId,
          })),
        });
      }
    });

    this.logger.debug?.(`重建项目 ${projectId} 的数据集引用索引：${references.length} 条`);
  }

  /**
   * 获取单个数据集的引用数
   */
  async countReferences(datasetId: string): Promise<number> {
    return this.prisma.datasetReference.count({
      where: { datasetId },
    });
  }

  /**
   * 批量获取数据集的引用数（列表页用）
   *
   * @param datasetIds 数据集 ID 列表
   * @returns Map<datasetId, count>
   */
  async countReferencesBatch(datasetIds: string[]): Promise<Map<string, number>> {
    if (datasetIds.length === 0) return new Map();

    const grouped = await this.prisma.datasetReference.groupBy({
      by: ['datasetId'],
      where: { datasetId: { in: datasetIds } },
      _count: { datasetId: true },
    });

    const result = new Map<string, number>();
    // 初始化所有为 0
    for (const id of datasetIds) result.set(id, 0);
    // 填充实际值
    for (const g of grouped) {
      result.set(g.datasetId, g._count.datasetId);
    }
    return result;
  }

  /**
   * 删除/归档前校验引用
   *
   * 存在引用时抛出 DATASET_EXECUTION_FAILED（含引用详情），
   * 由调用方决定是否强制操作（需用户确认）。
   *
   * @param datasetId 数据集 ID
   * @throws BusinessException 当存在引用时
   */
  async checkReferencesBeforeDelete(datasetId: string): Promise<void> {
    const count = await this.countReferences(datasetId);
    if (count > 0) {
      throw new BusinessException(BizCode.DATASET_EXECUTION_FAILED, undefined, [
        `数据集被 ${count} 个组件引用，请先移除引用或确认强制删除`,
      ]);
    }
  }
}
