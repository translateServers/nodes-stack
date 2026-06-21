import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SheetService } from '@/modules/sheet/sheet.service';
import { DropdownOptionListSchema, type DropdownOption } from '@/modules/sheet/dto/sheet.dto';
import {
  ApiSuccessResponse,
  ApiGlobalErrors,
} from '@/common/decorators/api-success-response.decorator';
import { createZodDto } from 'nestjs-zod';

class DropdownOptionResponseDto extends createZodDto(DropdownOptionListSchema) {}

@ApiTags('表格模块')
@ApiBearerAuth()
@ApiGlobalErrors()
@Controller('sheet')
export class SheetController {
  constructor(private readonly sheetService: SheetService) {}

  @Get('dropdown-options')
  @ApiOperation({
    summary: '获取下拉选项',
    description: '根据字典类型编码获取下拉选项列表。',
  })
  @ApiSuccessResponse(DropdownOptionResponseDto, { isArray: true })
  getDropdownOptions(@Query('type') type: string): Promise<DropdownOption[]> {
    return this.sheetService.getDropdownOptions(type);
  }
}
