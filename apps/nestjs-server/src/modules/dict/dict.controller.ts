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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { DictService } from '@/modules/dict/dict.service';
import {
  type CreateDictTypeDto,
  type UpdateDictTypeDto,
  DictTypeResponseDto,
  type DictTypeResponse,
  type CreateDictValueDto,
  type UpdateDictValueDto,
  DictValueResponseDto,
  type DictValueResponse,
} from '@/modules/dict/dto/dict.dto';
import {
  ApiSuccessResponse,
  ApiSuccessNoDataResponse,
  ApiGlobalErrors,
} from '@/common/decorators/api-success-response.decorator';

@ApiTags('字典模块')
@ApiBearerAuth()
@ApiGlobalErrors()
@Controller('dict')
export class DictController {
  constructor(private readonly dictService: DictService) {}

  // ──────────────────────── 字典类型 ────────────────────────

  @Post('types')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建字典类型', description: '创建一个新的字典类型。' })
  @ApiSuccessResponse(DictTypeResponseDto, { status: HttpStatus.CREATED })
  createType(@Body() dto: CreateDictTypeDto): Promise<DictTypeResponse> {
    return this.dictService.createType(dto);
  }

  @Get('types')
  @ApiOperation({ summary: '获取所有字典类型', description: '获取系统中所有字典类型的列表。' })
  @ApiSuccessResponse(DictTypeResponseDto, { isArray: true })
  findAllTypes(): Promise<DictTypeResponse[]> {
    return this.dictService.findAllTypes();
  }

  @Get('types/:id')
  @ApiOperation({ summary: '获取字典类型详情', description: '获取指定 ID 的字典类型详细信息。' })
  @ApiSuccessResponse(DictTypeResponseDto)
  findTypeById(@Param('id') id: string): Promise<DictTypeResponse> {
    return this.dictService.findTypeById(id);
  }

  @Patch('types/:id')
  @ApiOperation({
    summary: '更新字典类型',
    description: '更新指定字典类型的信息。未提供的字段不会被修改。',
  })
  @ApiSuccessResponse(DictTypeResponseDto)
  updateType(@Param('id') id: string, @Body() dto: UpdateDictTypeDto): Promise<DictTypeResponse> {
    return this.dictService.updateType(id, dto);
  }

  @Delete('types/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '删除字典类型',
    description: '删除指定字典类型及其所有字典值。此操作不可恢复。',
  })
  @ApiSuccessNoDataResponse({ message: '删除成功' })
  removeType(@Param('id') id: string): Promise<void> {
    return this.dictService.removeType(id);
  }

  // ──────────────────────── 字典值 ────────────────────────

  @Post('values')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建字典值', description: '为指定字典类型创建一个新的字典值。' })
  @ApiSuccessResponse(DictValueResponseDto, { status: HttpStatus.CREATED })
  createValue(@Body() dto: CreateDictValueDto): Promise<DictValueResponse> {
    return this.dictService.createValue(dto);
  }

  @Get('types/:id/values')
  @ApiOperation({
    summary: '获取字典值列表',
    description: '获取指定字典类型下的所有字典值。',
  })
  @ApiSuccessResponse(DictValueResponseDto, { isArray: true })
  findValuesByTypeId(@Param('id') id: string): Promise<DictValueResponse[]> {
    return this.dictService.findValuesByTypeId(id);
  }

  @Patch('values/:id')
  @ApiOperation({
    summary: '更新字典值',
    description: '更新指定字典值的信息。未提供的字段不会被修改。',
  })
  @ApiSuccessResponse(DictValueResponseDto)
  updateValue(
    @Param('id') id: string,
    @Body() dto: UpdateDictValueDto,
  ): Promise<DictValueResponse> {
    return this.dictService.updateValue(id, dto);
  }

  @Delete('values/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除字典值', description: '删除指定字典值。此操作不可恢复。' })
  @ApiSuccessNoDataResponse({ message: '删除成功' })
  removeValue(@Param('id') id: string): Promise<void> {
    return this.dictService.removeValue(id);
  }
}
