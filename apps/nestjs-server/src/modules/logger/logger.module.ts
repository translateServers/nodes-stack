import { Module } from '@nestjs/common';
import { LogQueryService } from '@/modules/logger/log-query.service';

@Module({
  providers: [LogQueryService],
  exports: [LogQueryService],
})
export class LoggerModule {}
