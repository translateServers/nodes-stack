import { Module } from '@nestjs/common';
import { ScreenController } from './screen.controller';
import { ScreenService } from './screen.service';
import { DatasetModule } from '@/modules/dataset/dataset.module';

/**
 * ScreenModule 导入 DatasetModule 以使用 DatasetReferenceService，
 * 在项目保存时重建数据集引用索引（data-model §4.2）。
 */
@Module({
  imports: [DatasetModule],
  controllers: [ScreenController],
  providers: [ScreenService],
  exports: [ScreenService],
})
export class ScreenModule {}
