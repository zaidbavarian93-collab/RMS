import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../utils/format';
import { useBrand } from '../context/BrandContext';
import BrandMark from './BrandMark';
import { flushQueue, useOnline, useQueue, useServedFromCache } from '../utils/offline';

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
  const brand = useBrand();
  const online = useOnline();
  const stale = useServedFromCache();
  const [notice, setNotice] = useState(null);
  const { user, logout } = useAuth();
  const pending = useQueue().filter((q) => q.user_id === user?.id).length;
  const netStatus = !online ? 'offline' : stale ? 'stale' : pending ? 'syncing' : 'online';
  const NET_TEXT = {
    offline: `غير متصل${pending ? ` · ${pending} بانتظار الإرسال` : ''}`,
    stale: 'الخادم غير متاح · بيانات محفوظة',
    syncing: `جارٍ الإرسال · ${pending}`,
    online: 'متصل',
  };
  // إشعار عند إرسال الطلبات المحفوظة بعد عودة الاتصال (أو رفض الخادم لها)
  useEffect(() => {
    let t;
    const onFlushed = (e) => {
      const { sent, failed } = e.detail;
      const parts = [];
      if (sent) parts.push(`عاد الاتصال: أُرسل ${sent} طلب محفوظ إلى المطبخ`);
      failed.forEach((f) => parts.push(`طاولة ${f.entry.table_number}: ${f.message}`));
      setNotice({ text: parts.join(' — '), kind: failed.length ? 'err' : 'ok' });
      clearTimeout(t);
      t = setTimeout(() => setNotice(null), 6000);
    };
    window.addEventListener('rms-queue-flushed', onFlushed);
    return () => { window.removeEventListener('rms-queue-flushed', onFlushed); clearTimeout(t); };
  }, []);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="layout">
      <button type="button" className="mobile-nav-toggle" onClick={() => setOpen((v) => !v)} aria-label="القائمة">☰</button>
      {open && <div className="mobile-nav-backdrop" onClick={() => setOpen(false)} />}
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="brand">
          <BrandMark logo={brand.logo} size={44} />
          <div><h2>{brand.name}</h2><div className="brand-by">RMS by Starlight</div></div>
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
        <button type="button" className={`net-pill net-${netStatus}`} onClick={() => flushQueue()} title="حالة الاتصال — اضغط لإعادة المحاولة">
          <i className="net-dot" />{NET_TEXT[netStatus]}
        </button>
        <div className="sidebar-user">
          <div><b>{user.full_name}</b><div className="muted-light">{ROLE_LABELS[user.role]}</div></div>
          <button className="btn small secondary" onClick={logout}>خروج</button>
        </div>
        <div className="starlight-credit" title="RMS by Starlight · Starlight للحلول التقنية"><span className="starlight-chip"><img src="/icons/starlight-logo.png" alt="Starlight للحلول التقنية" /></span><small>RMS by Starlight</small></div>
      </aside>
      <main className="content">{children}</main>
      {notice && <div className={`toast ${notice.kind}`} role="status">{notice.text}</div>}
    </div>
  );
}
