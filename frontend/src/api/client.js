import axios from 'axios';
import { markServedFromCache } from '../utils/offline';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => {
    // عامل الخدمة يضيف X-RMS-Offline عند إرجاع آخر نسخة محفوظة بدل بيانات حيّة
    if (r.config.method === 'get') markServedFromCache(r.headers['x-rms-offline'] === '1');
    return r;
  },
  (error) => {
    const isAuthCall = error.config?.url?.startsWith('/auth/login');
    if (error.response?.headers?.['x-rms-offline'] === '1') markServedFromCache(true);
    if (error.response?.status === 401 && !isAuthCall) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const errMsg = (e, fallback = 'حدث خطأ') => e?.response?.data?.message || (!e?.response ? 'لا يوجد اتصال بالخادم — تحقق من الشبكة' : fallback);
export default api;
