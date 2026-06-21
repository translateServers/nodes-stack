import { Module } from '@nestjs/common';
import { SheetController } from '@/modules/sheet/sheet.controller';
import { SheetService } from '@/modules/sheet/sheet.service';

@Module({
  controllers: [SheetController],
  providers: [SheetService],
  exports: [SheetService],
})
export class SheetModule {}
