import type * as Monaco from 'monaco-editor';

type MonacoApi = typeof Monaco;

interface MonacoLoaderConfig {
  readonly monaco?: MonacoApi;
}

interface CancelablePromise<T> extends Promise<T> {
  cancel(): void;
}

let monacoInstance: MonacoApi | null = null;

function toCancelablePromise<T>(promise: Promise<T>): CancelablePromise<T> {
  return Object.assign(promise, { cancel: (): void => undefined });
}

const loader = {
  config(config: MonacoLoaderConfig): void {
    if (config.monaco !== undefined) monacoInstance = config.monaco;
  },
  init(): CancelablePromise<MonacoApi> {
    if (monacoInstance === null) {
      return toCancelablePromise(
        Promise.reject(new Error('Monaco 必须在调用 loader.init 前通过 loader.config 注入')),
      );
    }
    return toCancelablePromise(Promise.resolve(monacoInstance));
  },
  __getMonacoInstance(): MonacoApi | null {
    return monacoInstance;
  },
};

export default loader;
