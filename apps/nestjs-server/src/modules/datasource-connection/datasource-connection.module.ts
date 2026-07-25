import { Module } from '@nestjs/common';
import { DataSourceConnectionController } from '@/modules/datasource-connection/datasource-connection.controller';
import { DataSourceConnectionService } from '@/modules/datasource-connection/datasource-connection.service';

/**
 * 数据源连接管理模块
 *
 * 设计依据：`docs/specs/dataset-management/architecture.md` §1
 *
 * 提供数据源连接的 CRUD + 测试端点，支持 mysql / postgres / http-api 三类连接。
 * 凭证字段（password / authConfig）独立加密存储，响应中脱敏。
 */
@Module({
  controllers: [DataSourceConnectionController],
  providers: [DataSourceConnectionService],
  exports: [DataSourceConnectionService],
})
export class DataSourceConnectionModule {}
