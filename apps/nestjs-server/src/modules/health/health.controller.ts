import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { SkipThrottle } from '@/common/decorators/skip-throttle.decorator';
import { getCurrentTimeDatetime } from '@/common/utils/time.util';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/modules/redis/redis.service';

@ApiTags('health')
@Controller()
@SkipThrottle()
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: '健康检查' })
  @ApiResponse({
    status: 200,
    description: '服务健康状态',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['ok', 'degraded'],
          example: 'ok',
          description: '服务状态：ok 表示正常，degraded 表示降级',
        },
        timestamp: {
          type: 'string',
          example: '2026-06-07 12:00:00',
          description: '当前时间',
        },
        uptime: {
          type: 'number',
          example: 3600,
          description: '服务运行时间（秒）',
        },
        database: {
          type: 'string',
          enum: ['connected', 'disconnected'],
          example: 'connected',
          description: '数据库连接状态',
        },
        redis: {
          type: 'string',
          enum: ['connected', 'disconnected'],
          example: 'connected',
          description: 'Redis 连接状态',
        },
      },
    },
  })
  async check() {
    const [databaseOk, redisOk] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      this.redisService.ping(),
    ]);

    const database: 'connected' | 'disconnected' = databaseOk ? 'connected' : 'disconnected';
    const redis: 'connected' | 'disconnected' = redisOk ? 'connected' : 'disconnected';

    const allHealthy = databaseOk && redisOk;

    return {
      status: allHealthy ? 'ok' : 'degraded',
      timestamp: getCurrentTimeDatetime(),
      uptime: process.uptime(),
      database,
      redis,
    };
  }

  @Public()
  @Get('ping')
  @ApiOperation({ summary: 'Ping 检查' })
  @ApiResponse({
    status: 200,
    description: 'Ping 响应',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'pong',
          description: 'Ping 响应消息',
        },
      },
    },
  })
  ping() {
    return { message: 'pong' };
  }
}
