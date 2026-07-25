import { UnsupportedExecutor } from '@/modules/dataset/executors/unsupported.executor';
import { BusinessException } from '@/common/exceptions/business.exception';
import { BizCode } from '@/common/enums/biz-code.enum';

describe('UnsupportedExecutor', () => {
  let executor: UnsupportedExecutor;

  beforeEach(() => {
    executor = new UnsupportedExecutor();
  });

  describe('execute', () => {
    it('应抛出 DATASET_TYPE_NOT_SUPPORTED（80007）', async () => {
      const config = {
        type: 'sql' as const,
        connectionId: 'conn-1',
        sql: 'SELECT 1',
      };

      await expect(executor.execute(config, {})).rejects.toThrow(BusinessException);
      await expect(executor.execute(config, {})).rejects.toMatchObject({
        bizCode: BizCode.DATASET_TYPE_NOT_SUPPORTED,
      });
    });
  });

  describe('test', () => {
    it('应抛出 DATASET_TYPE_NOT_SUPPORTED（80007）', async () => {
      const config = {
        type: 'websocket' as const,
        url: 'ws://example.com',
        messageFormat: 'json' as const,
      };

      await expect(executor.test(config, {})).rejects.toMatchObject({
        bizCode: BizCode.DATASET_TYPE_NOT_SUPPORTED,
      });
    });
  });
});
