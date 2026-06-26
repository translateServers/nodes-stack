import {
  LayoutDashboard,
  Users,
  BookOpen,
  Shield,
  FileText,
  Table,
  FlaskConical,
} from 'lucide-react';

export interface NavItem {
  text: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const menuGroups: NavGroup[] = [
  {
    label: '概览',
    items: [{ text: '仪表盘', icon: LayoutDashboard, path: '/' }],
  },
  {
    label: '系统管理',
    items: [
      { text: '用户管理', icon: Users, path: '/users' },
      { text: '菜单管理', icon: BookOpen, path: '/menus' },
      { text: '角色管理', icon: Shield, path: '/roles' },
      { text: '字典管理', icon: FileText, path: '/dict' },
    ],
  },
  {
    label: '业务功能',
    items: [
      { text: '表格', icon: Table, path: '/sheet' },
      { text: '表格 Playground', icon: FlaskConical, path: '/data-table-playground' },
    ],
  },
];

export const pathLabels: Record<string, string> = {
  '/': '仪表盘',
  '/users': '用户管理',
  '/menus': '菜单管理',
  '/roles': '角色管理',
  '/dict': '字典管理',
  '/sheet': '表格',
  '/data-table-playground': '表格 Playground',
};
