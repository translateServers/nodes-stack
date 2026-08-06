import { Injectable, Logger } from '@nestjs/common';
import {
  MetricScreenHostResourceIntentSchema,
  ScreenDocumentJsonValueSchema,
  SCREEN_HOST_RESOURCE_MAX_RESPONSE_BYTES,
  ScreenHostResourceResponseSchema,
  type ExecuteScreenHostResource,
  type ScreenDocumentJsonValue,
  type ScreenHostResourceResponse,
  type ScreenHostResourceSummary,
} from '@nebula/shared/schemas';

import { BizCode } from '@/common/enums/biz-code.enum';
import { BusinessException } from '@/common/exceptions/business.exception';
import { DatasetService } from '@/modules/dataset/dataset.service';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class ScreenResourceService {
  private readonly logger = new Logger(ScreenResourceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly datasetService: DatasetService,
  ) {}

  async listResources(
    projectId: string,
    resourceType: string,
  ): Promise<ScreenHostResourceSummary[]> {
    await this.assertProjectAccess(projectId, false);
    if (resourceType !== 'metric') {
      throw new BusinessException(BizCode.VALIDATION_ERROR);
    }
    return this.datasetService.listMetricHostResources(projectId);
  }

  async executeResource(
    projectId: string,
    request: ExecuteScreenHostResource,
    isPreview: boolean,
  ): Promise<ScreenHostResourceResponse> {
    await this.assertProjectAccess(projectId, isPreview);

    const intent = MetricScreenHostResourceIntentSchema.safeParse(request.intent);
    if (!intent.success) {
      throw new BusinessException(BizCode.VALIDATION_ERROR);
    }

    // Context fields are correlation identifiers only; authorization uses projectId and resource ownership.
    this.logger.debug(
      `Screen host resource execute project=${projectId} context=${request.contextId} component=${request.componentId}`,
    );

    let data: unknown;
    try {
      data = await this.datasetService.executeMetricHostResource(
        projectId,
        intent.data.resourceId,
        isPreview,
      );
    } catch (error) {
      if (error instanceof BusinessException && error.bizCode === BizCode.SCREEN_NOT_FOUND) {
        throw error;
      }
      throw new BusinessException(BizCode.DATASET_EXECUTION_FAILED);
    }

    return ScreenHostResourceResponseSchema.parse({ data: this.toBoundedJson(data) });
  }

  private async assertProjectAccess(projectId: string, isPreview: boolean): Promise<void> {
    const project = await this.prisma.screenProject.findUnique({
      where: { id: projectId },
      select: { id: true, status: true },
    });
    if (project === null || (isPreview && project.status !== 'published')) {
      throw new BusinessException(BizCode.SCREEN_NOT_FOUND);
    }
  }

  private toBoundedJson(value: unknown): ScreenDocumentJsonValue {
    const parsed = ScreenDocumentJsonValueSchema.safeParse(value);
    if (!parsed.success) {
      throw new BusinessException(BizCode.VALIDATION_ERROR);
    }

    let serialized: string;
    try {
      serialized = JSON.stringify(parsed.data);
    } catch {
      throw new BusinessException(BizCode.VALIDATION_ERROR);
    }

    if (new TextEncoder().encode(serialized).byteLength > SCREEN_HOST_RESOURCE_MAX_RESPONSE_BYTES) {
      throw new BusinessException(BizCode.VALIDATION_ERROR);
    }

    return ScreenDocumentJsonValueSchema.parse(JSON.parse(serialized));
  }
}
