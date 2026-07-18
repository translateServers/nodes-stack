import { Test, type TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { FileController } from '@/modules/file/file.controller';
import { FileService } from '@/modules/file/file.service';

const mockFileService = {
  upload: jest.fn(),
  findByRowId: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
};

describe('FileController', () => {
  let controller: FileController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FileController],
      providers: [{ provide: FileService, useValue: mockFileService }],
    }).compile();

    controller = module.get<FileController>(FileController);
    jest.clearAllMocks();
  });

  describe('upload', () => {
    it('应将 file 和 rowId 委托给 fileService.upload', async () => {
      const file = { originalname: 'a.png' } as Express.Multer.File;
      const mockResponse = {
        id: 'file-1',
        rowId: 'row-1',
        fileName: 'a.png',
        fileSize: 100,
        mimeType: 'image/png',
        createdAt: '2025-06-01 10:00:00',
        updatedAt: '2025-06-01 10:00:00',
      };
      mockFileService.upload.mockResolvedValue(mockResponse);

      const result = await controller.upload(file, 'row-1');

      expect(mockFileService.upload).toHaveBeenCalledWith(file, 'row-1');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('findByRowId', () => {
    it('应将 rowId 委托给 fileService.findByRowId', async () => {
      const mockResponse = [
        {
          id: 'file-1',
          rowId: 'row-1',
          fileName: 'a.png',
          fileSize: 100,
          mimeType: 'image/png',
          createdAt: '2025-06-01 10:00:00',
          updatedAt: '2025-06-01 10:00:00',
        },
      ];
      mockFileService.findByRowId.mockResolvedValue(mockResponse);

      const result = await controller.findByRowId('row-1');

      expect(mockFileService.findByRowId).toHaveBeenCalledWith('row-1');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('download', () => {
    it('应调用 findOne 并以 res.download 传输文件（filePath + fileName）', async () => {
      const file = { filePath: 'uploads/a.png', fileName: 'a.png' };
      mockFileService.findOne.mockResolvedValue(file);
      const res = { download: jest.fn() } as unknown as Response;

      await controller.download('file-1', res);

      expect(mockFileService.findOne).toHaveBeenCalledWith('file-1');
      expect(res.download).toHaveBeenCalledWith('uploads/a.png', 'a.png');
    });
  });

  describe('remove', () => {
    it('应将 id 委托给 fileService.remove', async () => {
      mockFileService.remove.mockResolvedValue(undefined);

      await controller.remove('file-1');

      expect(mockFileService.remove).toHaveBeenCalledWith('file-1');
    });
  });
});
