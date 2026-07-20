import { Test, type TestingModule } from '@nestjs/testing';
import { promises as fs } from 'node:fs';
import { FileService } from '@/modules/file/file.service';
import { PrismaService } from '@/prisma/prisma.service';
import { BusinessException } from '@/common/exceptions/business.exception';
import { BizCode } from '@/common/enums/biz-code.enum';
import { TypedConfigService } from '@/config/typed-config.service';

jest.mock('node:fs', () => {
  const actual = jest.requireActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      mkdir: jest.fn(),
      writeFile: jest.fn(),
      unlink: jest.fn(),
    },
  };
});

interface FileEntity {
  id: string;
  rowId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  createdAt: Date;
  updatedAt: Date;
}

const mockPrismaService = {
  file: {
    create: jest.fn<Promise<FileEntity>, [unknown]>(),
    findMany: jest.fn<Promise<FileEntity[]>, [unknown]>(),
    findUnique: jest.fn<Promise<FileEntity | null>, [unknown]>(),
    delete: jest.fn<Promise<FileEntity>, [unknown]>(),
  },
};

const mockTypedConfigService = {
  get: jest.fn((path: string) => {
    if (path === 'file.uploadDir') return 'uploads';
    return undefined;
  }),
};

function makeFile(overrides: Partial<FileEntity> = {}): FileEntity {
  const now = new Date('2025-06-01T10:00:00.000Z');
  return {
    id: overrides.id ?? 'file-id',
    rowId: overrides.rowId ?? 'row-id',
    fileName: overrides.fileName ?? 'report.pdf',
    fileSize: overrides.fileSize ?? 1024,
    mimeType: overrides.mimeType ?? 'application/pdf',
    filePath: overrides.filePath ?? 'uploads/report.pdf',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

describe('FileService', () => {
  let service: FileService;
  const mockedFs = fs as unknown as {
    mkdir: jest.Mock;
    writeFile: jest.Mock;
    unlink: jest.Mock;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: TypedConfigService, useValue: mockTypedConfigService },
      ],
    }).compile();

    service = module.get<FileService>(FileService);

    jest.clearAllMocks();
    mockTypedConfigService.get.mockImplementation((path: string) => {
      if (path === 'file.uploadDir') return 'uploads';
      return undefined;
    });
  });

  describe('upload', () => {
    it('应创建目录、写入文件、创建 Prisma 记录并返回 FileResponse', async () => {
      const file = {
        originalname: 'photo.png',
        size: 2048,
        mimetype: 'image/png',
        buffer: Buffer.from('fake-image'),
      } as Express.Multer.File;

      mockPrismaService.file.create.mockResolvedValue(
        makeFile({ fileName: 'photo.png', fileSize: 2048, mimeType: 'image/png' }),
      );

      const result = await service.upload(file, 'row-1');

      expect(mockedFs.mkdir).toHaveBeenCalledWith('uploads', { recursive: true });
      expect(mockedFs.writeFile).toHaveBeenCalledTimes(1);
      // 文件名应保留扩展名
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const writtenPath = mockedFs.writeFile.mock.calls[0][0] as string;
      expect(writtenPath).toMatch(/\.png$/);
      expect(mockPrismaService.file.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            rowId: 'row-1',
            fileName: 'photo.png',
            fileSize: 2048,
            mimeType: 'image/png',
          }),
        }),
      );
      expect(result.id).toBe('file-id');
      // toFileResponse 应将 Date 转换为字符串
      expect(typeof result.createdAt).toBe('string');
      expect(typeof result.updatedAt).toBe('string');
    });

    it('应处理无扩展名的文件（不附加扩展名）', async () => {
      const file = {
        originalname: 'no-extension',
        size: 100,
        mimetype: 'application/octet-stream',
        buffer: Buffer.from('data'),
      } as Express.Multer.File;

      mockPrismaService.file.create.mockResolvedValue(makeFile({ fileName: 'no-extension' }));

      await service.upload(file, 'row-1');

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const writtenPath = mockedFs.writeFile.mock.calls[0][0] as string;
      // 不应以 . 开头加扩展名结尾
      const baseName = String(writtenPath).split('/').pop();
      expect(baseName).not.toMatch(/\.[a-zA-Z0-9]+$/);
    });

    it('每次上传应生成不同的存储文件名（含时间戳与随机串）', async () => {
      const file = {
        originalname: 'a.png',
        size: 1,
        mimetype: 'image/png',
        buffer: Buffer.from('x'),
      } as Express.Multer.File;
      mockPrismaService.file.create.mockResolvedValue(makeFile());

      await service.upload(file, 'row-1');
      await service.upload(file, 'row-1');

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const path1 = mockedFs.writeFile.mock.calls[0][0] as string;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const path2 = mockedFs.writeFile.mock.calls[1][0] as string;
      expect(path1).not.toBe(path2);
    });
  });

  describe('findByRowId', () => {
    it('应返回指定 rowId 的文件列表（按 createdAt desc 排序）', async () => {
      const files = [makeFile({ id: '1' }), makeFile({ id: '2' })];
      mockPrismaService.file.findMany.mockResolvedValue(files);

      const result = await service.findByRowId('row-1');

      expect(mockPrismaService.file.findMany).toHaveBeenCalledWith({
        where: { rowId: 'row-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(typeof result[0].createdAt).toBe('string');
    });

    it('应返回空数组当 rowId 无关联文件', async () => {
      mockPrismaService.file.findMany.mockResolvedValue([]);
      const result = await service.findByRowId('no-files');
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('应返回原始 file 对象当 id 存在（含 filePath，不做 toFileResponse）', async () => {
      const file = makeFile({ id: 'find-id', filePath: 'uploads/secret.pdf' });
      mockPrismaService.file.findUnique.mockResolvedValue(file);

      const result = await service.findOne('find-id');

      expect(mockPrismaService.file.findUnique).toHaveBeenCalledWith({ where: { id: 'find-id' } });
      // findOne 返回原始 FileEntity（含 filePath），不是 FileResponse
      expect(result.filePath).toBe('uploads/secret.pdf');
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('应抛出 BusinessException 当文件不存在', async () => {
      mockPrismaService.file.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(BusinessException);
    });

    it('异常 bizCode 应为 FILE_NOT_FOUND', async () => {
      mockPrismaService.file.findUnique.mockResolvedValue(null);

      try {
        await service.findOne('missing');
        fail('应抛出异常');
      } catch (err) {
        expect(err).toBeInstanceOf(BusinessException);
        expect((err as BusinessException).bizCode).toBe(BizCode.FILE_NOT_FOUND);
      }
    });
  });

  describe('remove', () => {
    it('应删除物理文件和 Prisma 记录', async () => {
      const file = makeFile({ id: 'del-id', filePath: 'uploads/file.pdf' });
      mockPrismaService.file.findUnique.mockResolvedValue(file);
      mockedFs.unlink.mockResolvedValue(undefined);

      await service.remove('del-id');

      expect(mockedFs.unlink).toHaveBeenCalledWith('uploads/file.pdf');
      expect(mockPrismaService.file.delete).toHaveBeenCalledWith({ where: { id: 'del-id' } });
    });

    it('物理文件已不存在时仍删除 Prisma 记录（unlink 错误被吞掉）', async () => {
      const file = makeFile({ id: 'del-id', filePath: 'uploads/missing.pdf' });
      mockPrismaService.file.findUnique.mockResolvedValue(file);
      mockedFs.unlink.mockRejectedValue(new Error('ENOENT'));

      await service.remove('del-id');

      expect(mockPrismaService.file.delete).toHaveBeenCalledWith({ where: { id: 'del-id' } });
    });

    it('应抛出 BusinessException 当文件不存在（不调用 unlink 与 delete）', async () => {
      mockPrismaService.file.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(BusinessException);
      expect(mockedFs.unlink).not.toHaveBeenCalled();
      expect(mockPrismaService.file.delete).not.toHaveBeenCalled();
    });
  });
});
