import '@testing-library/jest-dom/vitest';

/**
 * jsdom 未实现 `document.elementsFromPoint`（任务 9.4 吸管工具点击采样需要）。
 * 提供一个返回空数组的默认实现，让需要命中测试的用例可通过
 * `vi.spyOn(document, 'elementsFromPoint').mockReturnValue([...])` 覆盖。
 */
if (typeof document.elementsFromPoint !== 'function') {
  document.elementsFromPoint = () => [];
}
