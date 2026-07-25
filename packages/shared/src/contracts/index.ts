/**
 * API 契约注册表（端点元数据 + Schema 绑定）
 *
 * 设计依据：`docs/conventions/frontend-backend-contract.md`
 *
 * 本目录是前后端 API 契约的单一数据源：
 * - 每个模块一个 `*.contract.ts` 文件
 * - 声明端点路径、HTTP 方法、参数位置、阶段标记、Schema 引用
 * - 前后端共同消费，避免单方面修改导致对接失败
 */

export * from './dataset.contract.js';
