import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ALL_ITEMS, NAV_GROUPS, titleFor } from './nav';
import MenuBar from './MenuBar';
import Dock from './Dock';
import { prefersReducedMotion } from '../utils/motion';

const CLOSE_MS = 220;
const GENIE_MS = 480;

// رموز أزرار النافذة كما في macOS (تظهر عند المرور على المجموعة)
const GLYPH = {
  close: <svg viewBox="0 0 12 12"><path d="M3.6 3.6l4.8 4.8M8.4 3.6L3.6 8.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>,
  min: <svg viewBox="0 0 12 12"><path d="M2.8 6h6.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>,
  full: <svg viewBox="0 0 12 12"><path d="M3.3 8.7V4.6l4.1 4.1zM8.7 3.3v4.1L4.6 3.3z" fill="currentColor" /></svg>,
  exitFull: <svg viewBox="0 0 12 12"><path d="M6.6 6.6h3.1L6.6 9.7zM5.4 5.4H2.3l3.1-3.1z" fill="currentColor" /></svg>,
};

const canFullscreen = () => !!document.documentElement.requestFullscreen;

// سطح المكتب: شريط القوائم + شريط جانبي زجاجي عائم + نافذة المحتوى + Dock
// النافذة تتصرف كنافذة macOS: إغلاق (الأحمر)، تصغير إلى الـ Dock (الأصفر)، ملء الشاشة (الأخضر)
export default function Layout({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const windowRef = useRef(null);
  const [drawer, setDrawer] = useState(false);
  // open | closing | closed | minimizing | minimized | restoring
  const [win, setWin] = useState('open');
  const [fullscreen, setFullscreen] = useState(false);
  const [zoomed, setZoomed] = useState(false); // تكبير داخل المتصفح (نقرتان على شريط العنوان أو عند غياب Fullscreen API)

  useEffect(() => setDrawer(false), [location.pathname]);
  // أي انتقال لصفحة أخرى يفتح نافذتها
  useEffect(() => { setWin((w) => (w === 'minimized' || w === 'closed' ? 'open' : w)); }, [location.pathname]);

  const [notice, setNotice] = useState(null);
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

  useEffect(() => {
    const sync = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const quick = prefersReducedMotion();

  function close() {
    if (quick) return setWin('closed');
    setWin('closing');
    setTimeout(() => setWin('closed'), CLOSE_MS);
  }

  // تأثير "الجني": تنكمش النافذة باتجاه مكانها في الـ Dock
  function aimAtDock() {
    const w = windowRef.current?.getBoundingClientRect();
    const d = document.querySelector('.dock')?.getBoundingClientRect();
    if (!w || !d) return;
    windowRef.current.style.setProperty('--to-x', `${d.right - 40 - (w.left + w.width / 2)}px`);
    windowRef.current.style.setProperty('--to-y', `${d.top + d.height / 2 - (w.top + w.height / 2)}px`);
  }
  function minimize() {
    if (quick) return setWin('minimized');
    aimAtDock();
    setWin('minimizing');
    setTimeout(() => setWin('minimized'), GENIE_MS);
  }
  function restore() {
    if (quick) return setWin('open');
    setWin('restoring');
    setTimeout(() => setWin('open'), GENIE_MS);
  }

  async function toggleFullscreen() {
    if (canFullscreen()) {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
        return;
      } catch { /* المتصفح رفض (مثلًا داخل iframe) — نكتفي بالتكبير */ }
    }
    setZoomed((v) => !v);
  }

  // الـ Dock: فتح صفحة أو إعادة فتح نافذة مغلقة/مصغّرة
  function activate(item) {
    if (item.to === location.pathname) {
      if (win === 'minimized') restore();
      else if (win === 'closed') setWin('open');
      return;
    }
    navigate(item.to);
  }

  const expanded = fullscreen || zoomed;
  const current = ALL_ITEMS.find((i) => i.to === location.pathname);
  const hidden = win === 'closed' || win === 'minimized';

  return (
    <div className={`desktop${expanded ? ' no-sidebar zoomed' : ''}${fullscreen ? ' is-fullscreen' : ''}`}>
      <MenuBar onToggleSidebar={() => setDrawer((v) => !v)} />
      {drawer && <div className="drawer-backdrop" onClick={() => setDrawer(false)} />}
      <div className="layout">
        <aside className={`sidebar${drawer ? ' open' : ''}`}>
          <nav>
            {NAV_GROUPS.map((g) => {
              const items = g.items.filter((i) => i.roles.includes(user.role));
              if (!items.length) return null;
              return (
                <div className="nav-group" key={g.title}>
                  <div className="nav-group-title">{g.title}</div>
                  {items.map((i) => (
                    <NavLink
                      key={i.to} to={i.to} end={i.to === '/'}
                      className={({ isActive }) => (isActive ? 'active' : '')}
                      onClick={() => { if (i.to === location.pathname && hidden) setWin('open'); }}
                    >
                      <span className={`nav-icon tint-${i.tint}`} aria-hidden="true">{i.icon}</span><span>{i.label}</span>
                    </NavLink>
                  ))}
                </div>
              );
            })}
          </nav>
        </aside>
        <main className="content">
          {win === 'closed' && (
            <div className="empty-desktop">
              <div className="empty-card">
                <span className="empty-icon">{current?.icon || '🍽️'}</span>
                <b>لا توجد نوافذ مفتوحة</b>
                <small>افتح تطبيقًا من الـ Dock أو الشريط الجانبي</small>
                {current && <button className="btn small" onClick={() => setWin('open')}>إعادة فتح «{current.label}»</button>}
              </div>
            </div>
          )}
          {win !== 'closed' && (
            <section ref={windowRef} className={`window win-${win}`} aria-hidden={win === 'minimized'}>
              <div className="window-bar no-print" onDoubleClick={(e) => { if (!e.target.closest('.lights')) setZoomed((v) => !v); }}>
                <span className="lights">
                  <button type="button" className="light l-close" onClick={close} title="إغلاق" aria-label="إغلاق النافذة">{GLYPH.close}</button>
                  <button type="button" className="light l-min" onClick={minimize} title="تصغير إلى الـ Dock" aria-label="تصغير">{GLYPH.min}</button>
                  <button type="button" className="light l-max" onClick={toggleFullscreen} title={expanded ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'} aria-label="ملء الشاشة">{expanded ? GLYPH.exitFull : GLYPH.full}</button>
                </span>
                <span className="window-title">{titleFor(location.pathname)}</span>
                <span className="lights-spacer" />
              </div>
              {/* المحتوى يبقى مُحمّلًا عند التصغير حتى يستمر التحديث الحي وتعود النافذة كما تُركت */}
              <div className="window-body page-enter" key={location.pathname}>{children}</div>
            </section>
          )}
        </main>
      </div>
      {notice && <div className={`toast ${notice.kind}`} role="status">{notice.text}</div>}
      <Dock
        role={user.role}
        windowOpen={win !== 'closed'}
        minimized={win === 'minimized' ? current || { to: location.pathname, icon: '🗔', label: titleFor(location.pathname), tint: 'gray' } : null}
        onActivate={activate}
        onRestore={restore}
      />
    </div>
  );
}
