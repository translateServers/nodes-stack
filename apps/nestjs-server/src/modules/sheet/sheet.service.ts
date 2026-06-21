import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { DropdownOptionSchema, type DropdownOption } from '@/modules/sheet/dto/sheet.dto';

@Injectable()
export class SheetService {
  constructor(private readonly prisma: PrismaService) {}

  async getDropdownOptions(type: string): Promise<DropdownOption[]> {
    const values = await this.prisma.dictValue.findMany({
      where: {
        dictType: { code: type },
        isActive: true,
      },
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });

    return values.map((v) =>
      DropdownOptionSchema.parse({
        label: v.label,
        value: v.value,
      }),
    );
  }
}
