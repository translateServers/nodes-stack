import { Module } from '@nestjs/common';
import { FileController } from '@/modules/file/file.controller';
import { FileService } from '@/modules/file/file.service';

@Module({
  controllers: [FileController],
  providers: [FileService],
  exports: [FileService],
})
export class FileModule {}
