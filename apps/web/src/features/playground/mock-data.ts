/**
 * Data Table Playground 模拟数据。
 * 提供员工数据集，用于全面展示 DataTable 各项功能。
 */

export type EmployeeStatus = 'active' | 'leave' | 'inactive';

export interface Employee {
  id: string;
  name: string;
  department: string;
  position: string;
  email: string;
  salary: number;
  status: EmployeeStatus;
  joinDate: string; // ISO 日期字符串 YYYY-MM-DD
  performance: number; // 绩效评分 0-100
  level: string; // 职级
}

/** 部门选项（用于筛选与展示） */
export const DEPARTMENTS = [
  { label: '研发部', value: '研发部' },
  { label: '产品部', value: '产品部' },
  { label: '设计部', value: '设计部' },
  { label: '市场部', value: '市场部' },
  { label: '人事部', value: '人事部' },
  { label: '财务部', value: '财务部' },
] as const;

/** 状态选项 */
export const STATUS_OPTIONS = [
  { label: '在职', value: 'active' },
  { label: '休假', value: 'leave' },
  { label: '离职', value: 'inactive' },
] as const;

/** 职级选项 */
export const LEVELS = ['P5', 'P6', 'P7', 'P8', 'M1', 'M2', 'M3'] as const;

const FIRST_NAMES = [
  '伟',
  '芳',
  '娜',
  '敏',
  '静',
  '丽',
  '强',
  '磊',
  '军',
  '洋',
  '勇',
  '艳',
  '杰',
  '娟',
  '涛',
  '明',
  '超',
  '霞',
  '平',
  '刚',
  '桂英',
  '建华',
  '志强',
  '海燕',
  '晓东',
  '建国',
  '雪梅',
  '建军',
];
const LAST_NAMES = [
  '王',
  '李',
  '张',
  '刘',
  '陈',
  '杨',
  '赵',
  '黄',
  '周',
  '吴',
  '徐',
  '孙',
  '胡',
  '朱',
  '高',
  '林',
  '何',
  '郭',
  '马',
  '罗',
];

const POSITIONS_BY_DEPT: Record<string, string[]> = {
  研发部: ['前端工程师', '后端工程师', '全栈工程师', '架构师', '测试工程师', '运维工程师'],
  产品部: ['产品经理', '产品助理', '产品总监'],
  设计部: ['UI 设计师', 'UX 设计师', '视觉设计师', '设计主管'],
  市场部: ['市场专员', '品牌经理', '市场总监', '内容运营'],
  人事部: ['HR 专员', 'HRBP', '招聘经理', '人事总监'],
  财务部: ['会计', '财务分析师', '财务经理', '出纳'],
};

const STATUSES: EmployeeStatus[] = ['active', 'active', 'active', 'active', 'leave', 'inactive'];

/** 基于种子的伪随机数生成器，保证数据稳定可复现 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

/** 生成员工模拟数据集 */
function generateEmployees(count: number): Employee[] {
  const rand = seededRandom(20240626);
  const deptNames = DEPARTMENTS.map((d) => d.value);
  const employees: Employee[] = [];

  for (let i = 0; i < count; i++) {
    const lastName = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
    const firstName = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
    const name = `${lastName}${firstName}`;
    const department = deptNames[Math.floor(rand() * deptNames.length)];
    const positions = POSITIONS_BY_DEPT[department] ?? ['职员'];
    const position = positions[Math.floor(rand() * positions.length)];
    const status = STATUSES[Math.floor(rand() * STATUSES.length)];
    const level = LEVELS[Math.floor(rand() * LEVELS.length)];
    const salary = Math.floor(8000 + rand() * 27000);
    const performance = Math.floor(55 + rand() * 45);
    const year = 2018 + Math.floor(rand() * 7);
    const month = String(1 + Math.floor(rand() * 12)).padStart(2, '0');
    const day = String(1 + Math.floor(rand() * 28)).padStart(2, '0');
    const joinDate = `${year}-${month}-${day}`;
    const emailPrefix = `user${String(i + 1).padStart(3, '0')}`;

    employees.push({
      id: `EMP-${String(i + 1).padStart(4, '0')}`,
      name,
      department,
      position,
      email: `${emailPrefix}@nebula.com`,
      salary,
      status,
      joinDate,
      performance,
      level,
    });
  }

  return employees;
}

/** 完整员工数据集（48 条，用于分页演示） */
export const employees: Employee[] = generateEmployees(48);

/** 精简数据集（12 条，用于基础展示） */
export const employeesBasic: Employee[] = employees.slice(0, 12);

/** 状态展示配置 */
export const STATUS_CONFIG: Record<
  EmployeeStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' }
> = {
  active: { label: '在职', variant: 'default' },
  leave: { label: '休假', variant: 'secondary' },
  inactive: { label: '离职', variant: 'destructive' },
};

/** 格式化薪资为人民币显示 */
export function formatSalary(salary: number): string {
  return `¥${salary.toLocaleString('zh-CN')}`;
}

/** 格式化日期为中文显示 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}
