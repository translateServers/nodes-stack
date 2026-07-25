export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export const ENDPOINTS = {
  auth: {
    captcha: '/auth/captcha',
    register: '/auth/register',
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    profile: '/auth/profile',
  },
  users: '/users',
  health: {
    check: '',
    ping: '/ping',
  },
  menus: '/menus',
  roles: '/roles',
  dict: '/dict',
  files: '/files',
  screen: '/screen',
  // 数据集管理（见 docs/specs/dataset-management/architecture.md §2）
  // 路径前缀，动态 ID 与子动作（execute/test/batch）通过模板字符串拼接，
  // 与 screen 端点风格一致（如 `${ENDPOINTS.dataset}/${id}/execute`）
  dataset: '/dataset',
  datasourceConnection: '/datasource-connection',
} as const;
