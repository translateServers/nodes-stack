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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ScreenService } from '@/modules/screen/screen.service';
import { ScreenResourceService } from '@/modules/screen/screen-resource.service';
import {
  CreateScreenProjectDto,
  ExecuteScreenHostResourceDto,
  ListScreenHostResourcesQueryDto,
  PublishScreenProjectDto,
  ScreenHostResourceResponseDto,
  ScreenHostResourceSummaryDto,
  ScreenProjectResponseDto,
  UpdateScreenProjectDto,
  type ScreenHostResourceResponse,
  type ScreenHostResourceSummary,
  type ScreenProjectResponse,
} from '@/modules/screen/dto/screen.dto';
import {
  ApiSuccessResponse,
  ApiSuccessNoDataResponse,
  ApiGlobalErrors,
} from '@/common/decorators/api-success-response.decorator';
import { Public } from '@/common/decorators/public.decorator';

@ApiTags('大屏设计器')
@ApiBearerAuth()
@ApiGlobalErrors()
@Controller('screen')
export class ScreenController {
  constructor(
    private readonly screenService: ScreenService,
    private readonly screenResourceService: ScreenResourceService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建大屏项目', description: '创建一个新的大屏设计器项目。' })
  @ApiSuccessResponse(ScreenProjectResponseDto, { status: HttpStatus.CREATED })
  createProject(@Body() dto: CreateScreenProjectDto): Promise<ScreenProjectResponse> {
    return this.screenService.createProject(dto);
  }

  @Get()
  @ApiOperation({ summary: '获取所有大屏项目', description: '获取系统中所有大屏项目列表。' })
  @ApiSuccessResponse(ScreenProjectResponseDto, { isArray: true })
  findAllProjects(): Promise<ScreenProjectResponse[]> {
    return this.screenService.findAllProjects();
  }

  @Get(':projectId/resources')
  @ApiOperation({ summary: '获取项目宿主资源', description: '仅返回当前项目可执行的受控资源。' })
  @ApiSuccessResponse(ScreenHostResourceSummaryDto, { isArray: true })
  listResources(
    @Param('projectId') projectId: string,
    @Query() query: ListScreenHostResourcesQueryDto,
  ): Promise<ScreenHostResourceSummary[]> {
    return this.screenResourceService.listResources(projectId, query.resourceType);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取大屏项目详情', description: '获取指定 ID 的大屏项目详细信息。' })
  @ApiSuccessResponse(ScreenProjectResponseDto)
  findProjectById(@Param('id') id: string): Promise<ScreenProjectResponse> {
    return this.screenService.findProjectById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '更新大屏项目',
    description: '更新指定大屏项目的信息。未提供的字段不会被修改。',
  })
  @ApiSuccessResponse(ScreenProjectResponseDto)
  updateProject(
    @Param('id') id: string,
    @Body() dto: UpdateScreenProjectDto,
  ): Promise<ScreenProjectResponse> {
    return this.screenService.updateProject(id, dto);
  }

  @Post(':projectId/resources/execute')
  @ApiOperation({ summary: '执行项目宿主资源', description: '执行固定 resolver 允许的项目资源。' })
  @ApiSuccessResponse(ScreenHostResourceResponseDto)
  executeResource(
    @Param('projectId') projectId: string,
    @Body() dto: ExecuteScreenHostResourceDto,
  ): Promise<ScreenHostResourceResponse> {
    return this.screenResourceService.executeResource(projectId, dto, false);
  }

  @Post(':projectId/preview/resources/execute')
  @Public()
  @Throttle({ long: { ttl: 60_000, limit: 30 } })
  @ApiOperation({
    summary: '执行公开预览宿主资源',
    description: '仅允许已发布项目，且使用独立限流。',
  })
  @ApiSuccessResponse(ScreenHostResourceResponseDto)
  executePreviewResource(
    @Param('projectId') projectId: string,
    @Body() dto: ExecuteScreenHostResourceDto,
  ): Promise<ScreenHostResourceResponse> {
    return this.screenResourceService.executeResource(projectId, dto, true);
  }

  @Post(':id/publish')
  @ApiOperation({
    summary: '发布大屏项目',
    description: '基于保存基线将大屏项目状态设为已发布。',
  })
  @ApiSuccessResponse(ScreenProjectResponseDto)
  publishProject(
    @Param('id') id: string,
    @Body() dto: PublishScreenProjectDto,
  ): Promise<ScreenProjectResponse> {
    return this.screenService.publishProject(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除大屏项目', description: '删除指定大屏项目。此操作不可恢复。' })
  @ApiSuccessNoDataResponse({ message: '删除成功' })
  removeProject(@Param('id') id: string): Promise<void> {
    return this.screenService.removeProject(id);
  }

  @Get(':id/preview')
  @Public()
  @ApiOperation({
    summary: '预览大屏项目（公开）',
    description: '获取已发布的大屏项目数据，用于公开预览，无需登录。',
  })
  @ApiSuccessResponse(ScreenProjectResponseDto)
  previewProject(@Param('id') id: string): Promise<ScreenProjectResponse> {
    return this.screenService.findPublishedProjectById(id);
  }
}
