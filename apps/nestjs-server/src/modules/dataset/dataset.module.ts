import { Module } from '@nestjs/common';
import { DatasetController } from '@/modules/dataset/dataset.controller';
import { DatasetService } from '@/modules/dataset/dataset.service';
import { DatasetCacheService } from '@/modules/dataset/dataset-cache.service';
import { DatasetFilterService } from '@/modules/dataset/dataset-filter.service';
import { DatasetMockService } from '@/modules/dataset/dataset-mock.service';
import { DatasetReferenceService } from '@/modules/dataset/dataset-reference.service';
import { StaticExecutor } from '@/modules/dataset/executors/static.executor';
import { ApiExecutor } from '@/modules/dataset/executors/api.executor';
import { UnsupportedExecutor } from '@/modules/dataset/executors/unsupported.executor';

/**
 * 数据集管理模块
 *
 * 设计依据：`docs/specs/dataset-management/architecture.md` §1
 *
 * 导出 DatasetReferenceService 供 ScreenModule 在项目保存时重建引用索引。
 */
@Module({
  controllers: [DatasetController],
  providers: [
    DatasetService,
    DatasetCacheService,
    DatasetFilterService,
    DatasetMockService,
    DatasetReferenceService,
    StaticExecutor,
    ApiExecutor,
    UnsupportedExecutor,
  ],
  exports: [DatasetReferenceService],
})
export class DatasetModule {}
