import { Injectable, type OnModuleInit, type OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { TypedConfigService } from '@/config/typed-config.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: TypedConfigService) {
    const provider = config.get('database.provider');
    const url = config.get('database.url');

    if (provider === 'sqlite') {
      const adapter = new PrismaBetterSqlite3({
        url: url || 'file:./dev.db',
      });
      super({ adapter });
    } else {
      // PostgreSQL: Prisma 7 通过 prisma.config.ts 管理 datasource URL
      // 此处无需显式传递 datasources
      super();
    }

    this.logger.log(`Database provider: ${provider}`);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
