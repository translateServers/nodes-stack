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
  sheet: {
    dropdownOptions: '/sheet/dropdown-options',
  },
} as const;
