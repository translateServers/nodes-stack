import { Injectable } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { PrismaService } from '@/prisma/prisma.service';
import { BizCode } from '@/common/enums/biz-code.enum';
import { BusinessException } from '@/common/exceptions/business.exception';
import { TypedConfigService } from '@/config/typed-config.service';
import { FileResponseSchema, type FileResponse } from '@/modules/file/dto/file.dto';

@Injectable()
export class FileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: TypedConfigService,
  ) {}

  async upload(file: Express.Multer.File, rowId: string): Promise<FileResponse> {
    const uploadDir = this.config.get('file.uploadDir');
    await fs.mkdir(uploadDir, { recursive: true });

    const ext = path.extname(file.originalname);
    const storedName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    const filePath = path.join(uploadDir, storedName);

    await fs.writeFile(filePath, file.buffer);

    const created = await this.prisma.file.create({
      data: {
        rowId,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        filePath,
      },
    });

    return this.toFileResponse(created);
  }

  async findByRowId(rowId: string): Promise<FileResponse[]> {
    const files = await this.prisma.file.findMany({
      where: { rowId },
      orderBy: { createdAt: 'desc' },
    });
    return files.map((f) => this.toFileResponse(f));
  }

  async findOne(id: string) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) {
      throw new BusinessException(BizCode.FILE_NOT_FOUND);
    }
    return file;
  }

  async remove(id: string): Promise<void> {
    const file = await this.findOne(id);

    try {
      await fs.unlink(file.filePath);
    } catch {
      // 文件不存在时忽略
    }

    await this.prisma.file.delete({ where: { id } });
  }

  private toFileResponse(file: {
    id: string;
    rowId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    createdAt: Date;
    updatedAt: Date;
  }): FileResponse {
    return FileResponseSchema.parse({
      id: file.id,
      rowId: file.rowId,
      fileName: file.fileName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    });
  }
}
