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
import { RoleService } from '@/modules/role/role.service';
import {
  type CreateRoleDto,
  type UpdateRoleDto,
  type AssignMenusDto,
  RoleResponseDto,
  type RoleResponse,
} from '@/modules/role/dto/role.dto';
import {
  ApiSuccessResponse,
  ApiSuccessNoDataResponse,
  ApiGlobalErrors,
} from '@/common/decorators/api-success-response.decorator';

@ApiTags('角色模块')
@ApiBearerAuth()
@ApiGlobalErrors()
@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建角色', description: '创建一个新角色，提供角色名称和可选的描述。' })
  @ApiSuccessResponse(RoleResponseDto, { status: HttpStatus.CREATED })
  create(@Body() dto: CreateRoleDto): Promise<RoleResponse> {
    return this.roleService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '获取所有角色', description: '获取系统中所有角色的列表。' })
  @ApiSuccessResponse(RoleResponseDto, { isArray: true })
  findAll(): Promise<RoleResponse[]> {
    return this.roleService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取角色详情', description: '获取指定 ID 角色的详细信息。' })
  @ApiSuccessResponse(RoleResponseDto)
  findOne(@Param('id') id: string): Promise<RoleResponse> {
    return this.roleService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '更新角色',
    description: '更新指定角色的名称或描述。未提供的字段不会被修改。',
  })
  @ApiSuccessResponse(RoleResponseDto)
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto): Promise<RoleResponse> {
    return this.roleService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除角色', description: '删除指定角色。此操作不可恢复，请谨慎使用。' })
  @ApiSuccessNoDataResponse({ message: '删除成功' })
  remove(@Param('id') id: string): Promise<void> {
    return this.roleService.remove(id);
  }

  @Post(':id/menus')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '分配菜单',
    description: '为指定角色分配一组菜单权限，传入菜单 ID 列表。',
  })
  @ApiSuccessResponse(RoleResponseDto)
  assignMenus(@Param('id') id: string, @Body() dto: AssignMenusDto): Promise<RoleResponse> {
    return this.roleService.assignMenus(id, dto);
  }
}
