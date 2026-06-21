import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { FileService } from '@/modules/file/file.service';
import { FileResponseDto, type FileResponse } from '@/modules/file/dto/file.dto';
import {
  ApiSuccessResponse,
  ApiSuccessNoDataResponse,
  ApiGlobalErrors,
} from '@/common/decorators/api-success-response.decorator';

@ApiTags('文件模块')
@ApiBearerAuth()
@ApiGlobalErrors()
@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传文件', description: '上传文件并关联到指定业务行。' })
  @ApiSuccessResponse(FileResponseDto, { status: HttpStatus.CREATED })
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('rowId') rowId: string,
  ): Promise<FileResponse> {
    return this.fileService.upload(file, rowId);
  }

  @Get()
  @ApiOperation({ summary: '获取文件列表', description: '获取指定业务行关联的文件列表。' })
  @ApiSuccessResponse(FileResponseDto, { isArray: true })
  findByRowId(@Query('rowId') rowId: string): Promise<FileResponse[]> {
    return this.fileService.findByRowId(rowId);
  }

  @Get(':id/download')
  @ApiOperation({ summary: '下载文件', description: '下载指定 ID 的文件。' })
  async download(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const file = await this.fileService.findOne(id);
    res.download(file.filePath, file.fileName);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除文件', description: '删除指定文件及其物理文件。此操作不可恢复。' })
  @ApiSuccessNoDataResponse({ message: '删除成功' })
  remove(@Param('id') id: string): Promise<void> {
    return this.fileService.remove(id);
  }
}
