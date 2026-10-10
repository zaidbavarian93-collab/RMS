import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../utils/format';

const ADMIN = ['owner', 'manager'];
const NAV_GROUPS = [
  { title: 'نظرة عامة', items: [{ to: '/', label: 'لوحة التحكم', icon: '📊', roles: ADMIN }] },
  {
    title: 'نظام الكابتن والصالة',
    items: [
      { to: '/captain', label: 'الكابتن - الطاولات', icon: '🧑‍🍳', roles: ['owner', 'manager', 'cashier', 'captain'] },
      { to: '/kitchen', label: 'شاشة المطبخ', icon: '🍳', roles: [...ADMIN, 'kitchen', 'captain', 'cashier'] },
      { to: '/cashier', label: 'الكاشير والفواتير', icon: '💵', roles: [...ADMIN, 'cashier'] },
      { to: '/orders', label: 'سجل الطلبات', icon: '🧾', roles: ['owner', 'manager', 'cashier', 'captain'] },
    ],
  },
  {
    title: 'نظام المنيو',
    items: [
      { to: '/menu', label: 'إدارة المنيو', icon: '📖', roles: ADMIN },
      { to: '/tables', label: 'الطاولات ورموز QR', icon: '🪑', roles: ADMIN },
    ],
  },
  {
    title: 'إدارة المطعم',
    items: [
      { to: '/inventory', label: 'المخزون', icon: '📦', roles: ADMIN },
      { to: '/reports', label: 'التقارير', icon: '📈', roles: [...ADMIN, 'cashier'] },
      { to: '/users', label: 'الموظفون', icon: '👥', roles: ADMIN },
      { to: '/audit-logs', label: 'سجل التدقيق', icon: '🛡️', roles: ADMIN },
      { to: '/settings', label: 'الإعدادات', icon: '⚙️', roles: ADMIN },
    ],
  },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="layout">
      <button type="button" className="mobile-nav-toggle" onClick={() => setOpen((v) => !v)} aria-label="القائمة">☰</button>
      {open && <div className="mobile-nav-backdrop" onClick={() => setOpen(false)} />}
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="brand">
          <span className="logo-dot">🍽️</span>
          <div><h2>نظام إدارة المطاعم</h2><div className="brand-by">RMS</div></div>
        </div>
        <nav>
          {NAV_GROUPS.map((g) => {
            const items = g.items.filter((i) => i.roles.includes(user.role));
            if (!items.length) return null;
            return (
              <div className="nav-group" key={g.title}>
                <div className="nav-group-title">{g.title}</div>
                {items.map((i) => (
                  <NavLink key={i.to} to={i.to} end={i.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
                    <span aria-hidden="true">{i.icon}</span><span>{i.label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-user">
          <div><b>{user.full_name}</b><div className="muted-light">{ROLE_LABELS[user.role]}</div></div>
          <button className="btn small secondary" onClick={logout}>خروج</button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
