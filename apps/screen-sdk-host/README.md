# Screen SDK Vanilla Host

`@nebula/screen-sdk-host` 是不依赖 React 的 Vanilla TypeScript 参考宿主，也是 SDK 的浏览器 E2E 宿主。

## Commands

```bash
pnpm dev:sdk-host
pnpm --filter @nebula/screen-sdk-host build
pnpm --filter @nebula/screen-sdk-host e2e
```

开发地址为 `http://127.0.0.1:5174`。`scenario` 查询参数支持 `single`、`dual`、`hostile` 和 `small`。

宿主运行时只依赖 `@nebula/screen-sdk`。项目、revision、导入导出与快照均由 `InMemoryScreenHostAdapter` 管理，不读取 SDK 私有 Store。
