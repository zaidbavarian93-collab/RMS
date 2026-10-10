import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useClock } from '../utils/motion';
import { ROLE_LABELS } from '../utils/format';
import { titleFor } from './nav';
import { flushQueue, useOnline, useQueue, useServedFromCache } from '../utils/offline';

// أيقونات المظهر كـ SVG (رموز النص مثل ◐ لا تتوفر في كل الخطوط)
const THEME_ICON = {
  auto: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" /></svg>,
  light: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" /></svg>,
  dark: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" /></svg>,
};
const THEME_LABEL = { auto: 'تلقائي', light: 'فاتح', dark: 'داكن' };

// شريط القوائم العلوي على طريقة macOS: اسم التطبيق والصفحة، المظهر، الساعة، قائمة المستخدم
export default function MenuBar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const { pref, cycle } = useTheme();
  const { pathname } = useLocation();
  const now = useClock();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const online = useOnline();
  const stale = useServedFromCache();
  const pending = useQueue().filter((q) => q.user_id === user.id).length;
  const status = !online ? 'offline' : stale ? 'stale' : pending ? 'syncing' : 'online';
  const STATUS_TEXT = {
    offline: `غير متصل${pending ? ` · ${pending} بانتظار الإرسال` : ''}`,
    stale: 'الخادم غير متاح · بيانات محفوظة',
    syncing: `جارٍ الإرسال · ${pending}`,
    online: 'متصل',
  };

  const date = now.toLocaleDateString('ar-IQ', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = now.toLocaleTimeString('ar-IQ', { hour: 'numeric', minute: '2-digit' });

  return (
    <header className="menubar no-print">
      <div className="mb-start">
        <button type="button" className="mb-item mb-burger" onClick={onToggleSidebar} aria-label="الشريط الجانبي">☰</button>
        <span className="mb-apple">🍽️</span>
        <b className="mb-item mb-app">RMS</b>
        <span className="mb-item mb-title">{titleFor(pathname)}</span>
      </div>
      <div className="mb-end">
        <button type="button" className={`mb-item mb-net net-${status}`} onClick={() => flushQueue()} title="حالة الاتصال — اضغط لإعادة المحاولة">
          <i className="net-dot" />{STATUS_TEXT[status]}
        </button>
        <button type="button" className="mb-item" onClick={cycle} title={`المظهر: ${THEME_LABEL[pref]}`} aria-label={`المظهر: ${THEME_LABEL[pref]}`}>{THEME_ICON[pref]}</button>
        <span className="mb-item mb-clock">{date}&nbsp;&nbsp;{time}</span>
        <div className="mb-menu" ref={menuRef}>
          <button type="button" className={`mb-item${open ? ' pressed' : ''}`} onClick={() => setOpen((v) => !v)}>
            <span className="mb-avatar">{user.full_name.slice(0, 1)}</span>{user.full_name}
          </button>
          {open && (
            <div className="mb-dropdown">
              <div className="mb-dd-head"><b>{user.full_name}</b><small>{ROLE_LABELS[user.role]} · {user.username}</small></div>
              <hr />
              <button type="button" onClick={cycle}>المظهر: {THEME_LABEL[pref]}</button>
              <hr />
              <button type="button" onClick={logout}>تسجيل الخروج…</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
