import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NAV_GROUPS, titleFor } from './nav';
import MenuBar from './MenuBar';
import Dock from './Dock';

// سطح المكتب: شريط القوائم + شريط جانبي زجاجي عائم + نافذة المحتوى + Dock
export default function Layout({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);       // الشريط الجانبي على الموبايل
  const [collapsed, setCollapsed] = useState(false); // إخفاء الشريط الجانبي (الزر الأصفر)
  const [zoomed, setZoomed] = useState(false);       // ملء الشاشة (الزر الأخضر)
  useEffect(() => setDrawer(false), [location.pathname]);

  return (
    <div className={`desktop${collapsed || zoomed ? ' no-sidebar' : ''}${zoomed ? ' zoomed' : ''}`}>
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
                    <NavLink key={i.to} to={i.to} end={i.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
                      <span className={`nav-icon tint-${i.tint}`} aria-hidden="true">{i.icon}</span><span>{i.label}</span>
                    </NavLink>
                  ))}
                </div>
              );
            })}
          </nav>
        </aside>
        <main className="content">
          <section className="window">
            <div className="window-bar no-print">
              <span className="lights">
                <button type="button" className="light l-close" onClick={() => navigate(-1)} title="رجوع" aria-label="رجوع" />
                <button type="button" className="light l-min" onClick={() => setCollapsed((v) => !v)} title="إخفاء/إظهار الشريط الجانبي" aria-label="الشريط الجانبي" />
                <button type="button" className="light l-max" onClick={() => setZoomed((v) => !v)} title="ملء الشاشة" aria-label="ملء الشاشة" />
              </span>
              <span className="window-title">{titleFor(location.pathname)}</span>
              <span className="lights-spacer" />
            </div>
            <div className="window-body page-enter" key={location.pathname}>{children}</div>
          </section>
        </main>
      </div>
      <Dock role={user.role} />
    </div>
  );
}
