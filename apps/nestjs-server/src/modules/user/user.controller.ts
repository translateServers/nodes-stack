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
import { UserService } from '@/modules/user/user.service';
import {
  type CreateUserDto,
  type UpdateUserDto,
  type UserResponse,
  UserResponseDto,
} from './dto/user.dto';
import {
  ApiSuccessResponse,
  ApiSuccessNoDataResponse,
  ApiGlobalErrors,
} from '@/common/decorators/api-success-response.decorator';

@ApiTags('用户模块')
@ApiBearerAuth()
@ApiGlobalErrors()
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '创建用户',
    description: '创建一个新用户，需要提供邮箱、用户名和密码。密码会自动加密存储。',
  })
  @ApiSuccessResponse(UserResponseDto, { status: HttpStatus.CREATED })
  create(@Body() createUserDto: CreateUserDto): Promise<UserResponse> {
    return this.userService.create(createUserDto);
  }

  @Get()
  @ApiOperation({
    summary: '获取所有用户',
    description: '获取系统中所有用户的列表（不包含密码字段）。',
  })
  @ApiSuccessResponse(UserResponseDto, { isArray: true })
  findAll(): Promise<UserResponse[]> {
    return this.userService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: '根据ID获取用户',
    description: '获取指定ID用户的详细信息（不包含密码字段）。',
  })
  @ApiSuccessResponse(UserResponseDto)
  findOne(@Param('id') id: string): Promise<UserResponse> {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '更新用户',
    description: '更新指定用户的信息。可以更新邮箱、用户名或显示名称。未提供的字段不会被修改。',
  })
  @ApiSuccessResponse(UserResponseDto)
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto): Promise<UserResponse> {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: '删除用户',
    description: '删除指定用户及其相关数据（包括关联的刷新令牌）。此操作不可恢复，请谨慎使用。',
  })
  @ApiSuccessNoDataResponse({ message: '删除成功' })
  remove(@Param('id') id: string): Promise<void> {
    return this.userService.remove(id);
  }
}
