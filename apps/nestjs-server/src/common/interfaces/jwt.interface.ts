/**
 * JWT Payload 类型
 * 用于 Token 生成阶段
 */
export interface JwtPayload {
  /**
   * Subject - 用户 ID
   */
  sub: string;
}
