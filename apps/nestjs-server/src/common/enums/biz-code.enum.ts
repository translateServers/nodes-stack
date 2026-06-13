/**
 * 业务状态码规范
 *
 * 所有定义统一从 @nebula/shared 导出，确保前后端同源。
 *
 * 编码规则：
 * - 0        : 成功
 * - 1xxx     : 通用错误
 * - 10xxx    : 认证模块
 * - 20xxx    : 用户模块
 * - 30xxx    : 菜单模块
 * - 40xxx    : 角色模块
 * - 50xxx    : 字典模块
 */
export { BizCode, type BizCodeValue, BizMessage, getHttpStatus } from '@nebula/shared';
