import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ALL_ITEMS } from './nav';
import { prefersReducedMotion } from '../utils/motion';

const BASE = 50;        // حجم الأيقونة بالبكسل
const MAX_SCALE = 1.7;  // أقصى تكبير تحت المؤشر
const RANGE = 140;      // نطاق تأثير التكبير حول المؤشر

// Dock على طريقة macOS: تكبير الأيقونات حسب قربها من المؤشر + قفزة عند الفتح + نقطة للصفحة الحالية
export default function Dock({ role }) {
  const items = ALL_ITEMS.filter((i) => i.dock && i.roles.includes(role));
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const refs = useRef([]);
  const [scales, setScales] = useState({});
  const [bouncing, setBouncing] = useState(null);
  const canMagnify = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (min-width: 861px)').matches && !prefersReducedMotion();

  function onMove(e) {
    if (!canMagnify) return;
    const next = {};
    refs.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const d = Math.abs(e.clientX - (r.left + r.width / 2));
      const t = Math.max(0, 1 - d / RANGE);
      next[i] = 1 + (MAX_SCALE - 1) * (Math.cos((1 - t) * Math.PI / 2) ** 2);
    });
    setScales(next);
  }

  function open(item) {
    if (item.to === pathname) return;
    setBouncing(item.to);
    setTimeout(() => setBouncing(null), 650);
    navigate(item.to);
  }

  if (items.length < 2) return null;
  return (
    <nav className="dock no-print" onMouseMove={onMove} onMouseLeave={() => setScales({})} aria-label="الوصول السريع">
      {items.map((item, i) => {
        const s = scales[i] || 1;
        return (
          <button
            key={item.to}
            ref={(el) => { refs.current[i] = el; }}
            className={`dock-item${pathname === item.to ? ' running' : ''}${bouncing === item.to ? ' bounce' : ''}`}
            style={canMagnify ? { width: BASE * s, height: BASE * s } : undefined}
            onClick={() => open(item)}
            aria-label={item.label}
          >
            <span className={`dock-icon tint-${item.tint}`}>{item.icon}</span>
            <span className="dock-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
