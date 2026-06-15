import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { BizCode } from '@/common/enums/biz-code.enum';
import { BusinessException } from '@/common/exceptions/business.exception';
import type {
  CreateDictTypeDto,
  UpdateDictTypeDto,
  DictTypeResponse,
  CreateDictValueDto,
  UpdateDictValueDto,
  DictValueResponse,
} from '@/modules/dict/dto/dict.dto';
import { DictTypeResponseSchema, DictValueResponseSchema } from '@/modules/dict/dto/dict.dto';

@Injectable()
export class DictService {
  constructor(private prisma: PrismaService) {}

  // ──────────────────────── 字典类型 ────────────────────────

  async createType(dto: CreateDictTypeDto): Promise<DictTypeResponse> {
    const existing = await this.prisma.dictType.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new BusinessException(BizCode.DICT_TYPE_ALREADY_EXISTS);
    }

    const created = await this.prisma.dictType.create({
      data: {
        code: dto.code,
        name: dto.name,
        remark: dto.remark ?? null,
        isActive: dto.isActive ?? true,
        sort: dto.sort ?? 0,
      },
    });

    return this.toTypeResponse(created);
  }

  async findAllTypes(): Promise<DictTypeResponse[]> {
    const types = await this.prisma.dictType.findMany({
      orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
    });
    return types.map((type) => this.toTypeResponse(type));
  }

  async findTypeById(id: string): Promise<DictTypeResponse> {
    const type = await this.prisma.dictType.findUnique({
      where: { id },
    });
    if (!type) {
      throw new BusinessException(BizCode.DICT_TYPE_NOT_FOUND);
    }
    return this.toTypeResponse(type);
  }

  async updateType(id: string, dto: UpdateDictTypeDto): Promise<DictTypeResponse> {
    await this.findTypeById(id);

    if (dto.code && dto.code.length > 0) {
      const duplicate = await this.prisma.dictType.findFirst({
        where: {
          code: dto.code,
          NOT: { id },
        },
      });
      if (duplicate) {
        throw new BusinessException(BizCode.DICT_TYPE_ALREADY_EXISTS);
      }
    }

    const updated = await this.prisma.dictType.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.remark !== undefined ? { remark: dto.remark ?? null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sort !== undefined ? { sort: dto.sort } : {}),
      },
    });

    return this.toTypeResponse(updated);
  }

  async removeType(id: string): Promise<void> {
    await this.findTypeById(id);
    await this.prisma.dictType.delete({
      where: { id },
    });
  }

  private toTypeResponse(type: {
    id: string;
    code: string;
    name: string;
    remark: string | null;
    sort: number;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
  }): DictTypeResponse {
    return DictTypeResponseSchema.parse({
      id: type.id,
      code: type.code,
      name: type.name,
      remark: type.remark,
      isActive: type.isActive,
      sort: type.sort,
      createdAt: type.createdAt,
      updatedAt: type.updatedAt,
    });
  }

  // ──────────────────────── 字典值 ────────────────────────

  async createValue(dto: CreateDictValueDto): Promise<DictValueResponse> {
    await this.findTypeById(dto.dictTypeId);

    const existing = await this.prisma.dictValue.findFirst({
      where: {
        dictTypeId: dto.dictTypeId,
        code: dto.code,
      },
    });
    if (existing) {
      throw new BusinessException(BizCode.DICT_VALUE_ALREADY_EXISTS);
    }

    const created = await this.prisma.dictValue.create({
      data: {
        dictTypeId: dto.dictTypeId,
        code: dto.code,
        label: dto.label,
        value: dto.value,
        color: dto.color ?? null,
        remark: dto.remark ?? null,
        isActive: dto.isActive ?? true,
        sort: dto.sort ?? 0,
      },
    });

    return this.toValueResponse(created);
  }

  async findValuesByTypeId(dictTypeId: string): Promise<DictValueResponse[]> {
    await this.findTypeById(dictTypeId);

    const values = await this.prisma.dictValue.findMany({
      where: { dictTypeId },
      orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
    });
    return values.map((value) => this.toValueResponse(value));
  }

  async findValueById(id: string): Promise<DictValueResponse> {
    const value = await this.prisma.dictValue.findUnique({
      where: { id },
    });
    if (!value) {
      throw new BusinessException(BizCode.DICT_VALUE_NOT_FOUND);
    }
    return this.toValueResponse(value);
  }

  async updateValue(id: string, dto: UpdateDictValueDto): Promise<DictValueResponse> {
    const existing = await this.prisma.dictValue.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new BusinessException(BizCode.DICT_VALUE_NOT_FOUND);
    }

    if (dto.code && dto.code.length > 0) {
      const duplicate = await this.prisma.dictValue.findFirst({
        where: {
          dictTypeId: existing.dictTypeId,
          code: dto.code,
          NOT: { id },
        },
      });
      if (duplicate) {
        throw new BusinessException(BizCode.DICT_VALUE_ALREADY_EXISTS);
      }
    }

    const updated = await this.prisma.dictValue.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.value !== undefined ? { value: dto.value } : {}),
        ...(dto.color !== undefined ? { color: dto.color ?? null } : {}),
        ...(dto.remark !== undefined ? { remark: dto.remark ?? null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sort !== undefined ? { sort: dto.sort } : {}),
      },
    });

    return this.toValueResponse(updated);
  }

  async removeValue(id: string): Promise<void> {
    await this.findValueById(id);
    await this.prisma.dictValue.delete({
      where: { id },
    });
  }

  private toValueResponse(value: {
    id: string;
    dictTypeId: string;
    code: string;
    label: string;
    value: string;
    color: string | null;
    sort: number;
    remark: string | null;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
  }): DictValueResponse {
    return DictValueResponseSchema.parse({
      id: value.id,
      dictTypeId: value.dictTypeId,
      code: value.code,
      label: value.label,
      value: value.value,
      color: value.color,
      remark: value.remark,
      isActive: value.isActive,
      sort: value.sort,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    });
  }
}
