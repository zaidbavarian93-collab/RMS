// تعريف واحد للتنقل يستخدمه الشريط الجانبي والـ Dock وعنوان النافذة
const ADMIN = ['owner', 'manager'];
const FLOOR = ['owner', 'manager', 'cashier', 'captain'];

export const NAV_GROUPS = [
  { title: 'نظرة عامة', items: [{ to: '/', label: 'لوحة التحكم', icon: '📊', tint: 'blue', roles: ADMIN, dock: true }] },
  {
    title: 'الكابتن والصالة',
    items: [
      { to: '/captain', label: 'الطاولات', icon: '🍽️', tint: 'orange', roles: FLOOR, dock: true },
      { to: '/kitchen', label: 'المطبخ', icon: '🍳', tint: 'red', roles: [...ADMIN, 'kitchen', 'captain', 'cashier'], dock: true },
      { to: '/cashier', label: 'الكاشير', icon: '💵', tint: 'green', roles: [...ADMIN, 'cashier'], dock: true },
      { to: '/orders', label: 'سجل الطلبات', icon: '🧾', tint: 'gray', roles: FLOOR },
    ],
  },
  {
    title: 'المنيو',
    items: [
      { to: '/menu', label: 'إدارة المنيو', icon: '📖', tint: 'yellow', roles: ADMIN, dock: true },
      { to: '/tables', label: 'الطاولات و QR', icon: '🪑', tint: 'teal', roles: ADMIN },
    ],
  },
  {
    title: 'الإدارة',
    items: [
      { to: '/inventory', label: 'المخزون', icon: '📦', tint: 'brown', roles: ADMIN, dock: true },
      { to: '/reports', label: 'التقارير', icon: '📈', tint: 'purple', roles: [...ADMIN, 'cashier'], dock: true },
      { to: '/users', label: 'الموظفون', icon: '👥', tint: 'indigo', roles: ADMIN },
      { to: '/audit-logs', label: 'سجل التدقيق', icon: '🛡️', tint: 'gray', roles: ADMIN },
      { to: '/settings', label: 'الإعدادات', icon: '⚙️', tint: 'gray', roles: ADMIN, dock: true },
    ],
  },
];

export const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);
export const titleFor = (path) => ALL_ITEMS.find((i) => i.to === path)?.label || 'نظام إدارة المطاعم';
