import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Query,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request as ExpressRequest } from 'express';
import { DatasetService } from '@/modules/dataset/dataset.service';
import type {
  DatasetResponse,
  DatasetExecuteResultResponse,
  TestDatasetResultResponse,
  DatasetReferenceCountResponse,
  BatchExecuteDatasetResultResponse,
} from '@/modules/dataset/dto/dataset.dto';
import {
  CreateDatasetDto,
  UpdateDatasetDto as UpdateDatasetDtoClass,
  ExecuteDatasetDto as ExecuteDatasetDtoClass,
  BatchExecuteDatasetDto as BatchExecuteDatasetDtoClass,
  ListDatasetQueryDto as ListDatasetQueryDtoClass,
  DatasetResponseDto,
  DatasetExecuteResultDto,
  TestDatasetResultDto,
  DatasetReferenceCountDto,
  BatchExecuteDatasetResultDto,
} from '@/modules/dataset/dto/dataset.dto';
import {
  ApiSuccessResponse,
  ApiSuccessNoDataResponse,
  ApiGlobalErrors,
} from '@/common/decorators/api-success-response.decorator';
import { Public } from '@/common/decorators/public.decorator';
import type { UserPayload } from '@/common/interfaces/user.interface';

/**
 * 数据集管理 Controller
 *
 * 设计依据：`docs/specs/dataset-management/architecture.md` §2
 *
 * 鉴权策略（security-decisions §7.3 / §7.5）：
 * - CRUD / test：JWT 鉴权（登录用户）
 * - execute：@Public 匿名可访问（预览页），但仅允许执行已发布项目的数据集（service 层校验）
 *   配独立限流（每 IP 每分钟 30 次）
 */
@ApiTags('数据集管理')
@ApiBearerAuth()
@ApiGlobalErrors()
@Controller('dataset')
export class DatasetController {
  constructor(private readonly datasetService: DatasetService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建数据集', description: '创建一个新的数据集实体。' })
  @ApiSuccessResponse(DatasetResponseDto, { status: HttpStatus.CREATED })
  create(
    @Body() dto: CreateDatasetDto,
    @Request() req: ExpressRequest & { user?: UserPayload },
  ): Promise<DatasetResponse> {
    return this.datasetService.create(dto, req.user!.id);
  }

  @Post('batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '批量执行数据集',
    description:
      '按 ids 列表批量执行数据集，单个失败不影响其他。需登录（非 @Public），不校验项目发布状态。',
  })
  @ApiSuccessResponse(BatchExecuteDatasetResultDto, { isArray: true })
  batchExecute(
    @Body() dto: BatchExecuteDatasetDtoClass,
  ): Promise<BatchExecuteDatasetResultResponse> {
    return this.datasetService.batchExecute(dto);
  }

  @Get()
  @ApiOperation({ summary: '获取数据集列表', description: '按 projectId 过滤获取数据集列表。' })
  @ApiSuccessResponse(DatasetResponseDto, { isArray: true })
  findAll(@Query() query: ListDatasetQueryDtoClass): Promise<DatasetResponse[]> {
    return this.datasetService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取数据集详情', description: '获取指定 ID 的数据集详细信息。' })
  @ApiSuccessResponse(DatasetResponseDto)
  findOne(@Param('id') id: string): Promise<DatasetResponse> {
    return this.datasetService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '更新数据集',
    description: '更新指定数据集的配置。未提供的字段不会被修改。',
  })
  @ApiSuccessResponse(DatasetResponseDto)
  update(@Param('id') id: string, @Body() dto: UpdateDatasetDtoClass): Promise<DatasetResponse> {
    return this.datasetService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '删除数据集',
    description: '删除指定数据集。存在组件引用时拒绝删除。',
  })
  @ApiSuccessNoDataResponse({ message: '删除成功' })
  remove(@Param('id') id: string): Promise<void> {
    return this.datasetService.remove(id);
  }

  @Post(':id/execute')
  @Public()
  @Throttle({ long: { ttl: 60_000, limit: 30 } })
  @ApiOperation({
    summary: '执行数据集（公开）',
    description:
      '执行数据集并返回结果。匿名可访问，但非 Mock 模式下仅允许执行已发布项目的数据集。配独立限流（每 IP 每分钟 30 次）。',
  })
  @ApiSuccessResponse(DatasetExecuteResultDto)
  execute(
    @Param('id') id: string,
    @Body() dto: ExecuteDatasetDtoClass,
    @Request() req: ExpressRequest & { user?: UserPayload },
  ): Promise<DatasetExecuteResultResponse> {
    // execute 端点为 @Public，req.user 可能为 undefined（匿名访问）
    const isAnonymous = !req.user;
    return this.datasetService.execute(id, dto, isAnonymous);
  }

  @Post(':id/test')
  @ApiOperation({
    summary: '测试执行数据集',
    description: '测试执行数据集，不缓存，返回原始与解析后结果。需登录。',
  })
  @ApiSuccessResponse(TestDatasetResultDto)
  test(
    @Param('id') id: string,
    @Body() dto: ExecuteDatasetDtoClass,
  ): Promise<TestDatasetResultResponse> {
    return this.datasetService.test(id, dto);
  }

  @Get(':id/references')
  @ApiOperation({
    summary: '获取数据集引用数',
    description: '获取指定数据集被组件引用的次数。',
  })
  @ApiSuccessResponse(DatasetReferenceCountDto)
  getReferenceCount(@Param('id') id: string): Promise<DatasetReferenceCountResponse> {
    return this.datasetService.getReferenceCount(id);
  }
}
