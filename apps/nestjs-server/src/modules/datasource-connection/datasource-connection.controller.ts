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
import type { Request as ExpressRequest } from 'express';
import { DataSourceConnectionService } from '@/modules/datasource-connection/datasource-connection.service';
import type {
  DataSourceConnectionResponse,
  TestConnectionResultResponse,
} from '@/modules/datasource-connection/dto/datasource-connection.dto';
import {
  CreateDataSourceConnectionDto,
  UpdateDataSourceConnectionDto as UpdateDataSourceConnectionDtoClass,
  ListDataSourceConnectionQueryDto as ListDataSourceConnectionQueryDtoClass,
  DataSourceConnectionResponseDto,
  TestConnectionResultDto,
} from '@/modules/datasource-connection/dto/datasource-connection.dto';
import {
  ApiSuccessResponse,
  ApiSuccessNoDataResponse,
  ApiGlobalErrors,
} from '@/common/decorators/api-success-response.decorator';
import type { UserPayload } from '@/common/interfaces/user.interface';

/**
 * 数据源连接管理 Controller
 *
 * 设计依据：`docs/specs/dataset-management/architecture.md` §2
 *
 * 鉴权策略：所有端点均需 JWT 鉴权（无 @Public 端点）
 */
@ApiTags('数据源连接管理')
@ApiBearerAuth()
@ApiGlobalErrors()
@Controller('datasource-connection')
export class DataSourceConnectionController {
  constructor(private readonly connectionService: DataSourceConnectionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建数据源连接', description: '创建一个新的数据源连接。' })
  @ApiSuccessResponse(DataSourceConnectionResponseDto, { status: HttpStatus.CREATED })
  create(
    @Body() dto: CreateDataSourceConnectionDto,
    @Request() req: ExpressRequest & { user?: UserPayload },
  ): Promise<DataSourceConnectionResponse> {
    return this.connectionService.create(dto, req.user!.id);
  }

  @Get()
  @ApiOperation({
    summary: '获取数据源连接列表',
    description: '按 projectId 过滤获取数据源连接列表。',
  })
  @ApiSuccessResponse(DataSourceConnectionResponseDto, { isArray: true })
  findAll(
    @Query() query: ListDataSourceConnectionQueryDtoClass,
  ): Promise<DataSourceConnectionResponse[]> {
    return this.connectionService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: '获取数据源连接详情',
    description: '获取指定 ID 的数据源连接详细信息。',
  })
  @ApiSuccessResponse(DataSourceConnectionResponseDto)
  findOne(@Param('id') id: string): Promise<DataSourceConnectionResponse> {
    return this.connectionService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '更新数据源连接',
    description: '更新指定数据源连接的配置。未提供的字段不会被修改。',
  })
  @ApiSuccessResponse(DataSourceConnectionResponseDto)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDataSourceConnectionDtoClass,
  ): Promise<DataSourceConnectionResponse> {
    return this.connectionService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '删除数据源连接',
    description: '删除指定数据源连接。',
  })
  @ApiSuccessNoDataResponse({ message: '删除成功' })
  remove(@Param('id') id: string): Promise<void> {
    return this.connectionService.remove(id);
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '测试数据源连接',
    description: '测试数据源连接是否可用。返回测试结果，并更新 lastTestedAt / lastTestResult。',
  })
  @ApiSuccessResponse(TestConnectionResultDto)
  test(@Param('id') id: string): Promise<TestConnectionResultResponse> {
    return this.connectionService.test(id);
  }
}
