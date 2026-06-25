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
import { MenuService } from './menu.service';
import {
  type CreateMenuDto,
  type UpdateMenuDto,
  type MenuResponse,
  MenuResponseDto,
} from './dto/menu.dto';
import {
  ApiSuccessResponse,
  ApiSuccessNoDataResponse,
  ApiGlobalErrors,
} from '@/common/decorators/api-success-response.decorator';
import type { MenuTreeNode } from '@nebula/shared/schemas';

@ApiTags('菜单模块')
@ApiBearerAuth()
@ApiGlobalErrors()
@Controller('menus')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建菜单' })
  @ApiSuccessResponse(MenuResponseDto, { status: HttpStatus.CREATED })
  create(@Body() dto: CreateMenuDto): Promise<MenuResponse> {
    return this.menuService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '获取所有菜单（扁平列表）' })
  @ApiSuccessResponse(MenuResponseDto, { isArray: true })
  findAll(): Promise<MenuResponse[]> {
    return this.menuService.findAll();
  }

  @Get('tree')
  @ApiOperation({ summary: '获取菜单树' })
  @ApiSuccessResponse(MenuResponseDto, { isArray: true })
  findTree(): Promise<MenuTreeNode[]> {
    return this.menuService.findTree();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取菜单详情' })
  @ApiSuccessResponse(MenuResponseDto)
  findOne(@Param('id') id: string): Promise<MenuResponse> {
    return this.menuService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新菜单' })
  @ApiSuccessResponse(MenuResponseDto)
  update(@Param('id') id: string, @Body() dto: UpdateMenuDto): Promise<MenuResponse> {
    return this.menuService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除菜单' })
  @ApiSuccessNoDataResponse({ message: '删除成功' })
  remove(@Param('id') id: string): Promise<void> {
    return this.menuService.remove(id);
  }
}
