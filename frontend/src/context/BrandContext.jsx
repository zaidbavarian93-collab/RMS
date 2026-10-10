import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';

// هوية المطعم (الاسم والشعار) — تُدار من صفحة الإعدادات وتظهر في كل الواجهة
const BrandContext = createContext({ name: 'نظام إدارة المطاعم', logo: null, refresh: () => {} });
const FALLBACK = 'نظام إدارة المطاعم';

function readCache() {
  try { return JSON.parse(localStorage.getItem('rms_brand')) || null; } catch { return null; }
}

export function BrandProvider({ children }) {
  const { user } = useAuth();
  // آخر هوية معروفة محفوظة على الجهاز حتى لا "يومض" الاسم الافتراضي عند الفتح أو بدون اتصال
  const [brand, setBrand] = useState(() => readCache() || { name: null, logo: null });

  const refresh = useCallback(async () => {
    try {
      let next;
      // قبل تغيير كلمة المرور الإجباري يرفض الخادم بقية المسارات، فنستخدم المسار العام
      if (user?.restaurant_id && !user.must_change_password) {
        const { data } = await api.get('/restaurants');
        const r = data.find((x) => x.id === user.restaurant_id) || data[0];
        next = { name: r?.name || null, logo: r?.logo_path || null };
      } else {
        const { data } = await api.get('/public/branding');
        next = { name: data.name, logo: data.logo_path };
      }
      setBrand(next);
      try { localStorage.setItem('rms_brand', JSON.stringify(next)); } catch { /* التخزين غير متاح */ }
    } catch { /* بدون اتصال: نبقي آخر هوية محفوظة */ }
  }, [user?.restaurant_id, user?.must_change_password]);

  useEffect(() => { refresh(); }, [refresh]);

  const name = brand.name || FALLBACK;
  // عنوان التبويب وأيقونته يتبعان هوية المطعم
  useEffect(() => {
    document.title = brand.name ? `${brand.name} — نظام الإدارة` : FALLBACK;
    const link = document.querySelector('link[rel="icon"]');
    if (link && brand.logo) link.href = brand.logo;
  }, [brand.name, brand.logo]);

  return <BrandContext.Provider value={{ name, logo: brand.logo, refresh }}>{children}</BrandContext.Provider>;
}

export const useBrand = () => useContext(BrandContext);
