import { Module } from '@nestjs/common';
import { ScreenController } from './screen.controller';
import { ScreenResourceService } from './screen-resource.service';
import { ScreenService } from './screen.service';
import { DatasetModule } from '@/modules/dataset/dataset.module';

/**
 * ScreenModule imports DatasetModule for the fixed host-resource resolver registry.
 */
@Module({
  imports: [DatasetModule],
  controllers: [ScreenController],
  providers: [ScreenService, ScreenResourceService],
  exports: [ScreenService],
})
export class ScreenModule {}
