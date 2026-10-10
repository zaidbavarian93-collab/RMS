import { useSyncExternalStore } from 'react';
import api from '../api/client';

// ===== حالة الاتصال =====
function subscribeOnline(cb) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb); };
}
export const useOnline = () => useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

// هل آخر بيانات معروضة جاءت من النسخة المحفوظة (عامل الخدمة أضاف X-RMS-Offline)؟
let servedFromCache = false;
const cacheListeners = new Set();
export function markServedFromCache(v) {
  if (servedFromCache === v) return;
  servedFromCache = v;
  cacheListeners.forEach((l) => l());
}
export const useServedFromCache = () => useSyncExternalStore((cb) => { cacheListeners.add(cb); return () => cacheListeners.delete(cb); }, () => servedFromCache);

// ===== طابور الطلبات غير المرسلة (يُحفظ على الجهاز حتى بعد إغلاق المتصفح) =====
const KEY = 'rms_offline_queue';
const listeners = new Set();
let snapshot = read();

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
function write(queue) {
  try { localStorage.setItem(KEY, JSON.stringify(queue)); } catch { /* التخزين ممتلئ أو غير متاح */ }
  snapshot = queue;
  listeners.forEach((l) => l());
}
window.addEventListener('storage', (e) => { if (e.key === KEY) { snapshot = read(); listeners.forEach((l) => l()); } });

export const useQueue = () => useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => snapshot);
export const getQueue = () => snapshot;

function currentUserId() {
  try { return JSON.parse(localStorage.getItem('user'))?.id || null; } catch { return null; }
}
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

// حفظ طلب الكابتن عند عدم وجود اتصال؛ المعرّف نفسه يُستخدم مفتاحًا لمنع التكرار على الخادم
export function enqueueOrder({ table_id, table_number, guests, items, lines }) {
  const entry = { id: newId(), user_id: currentUserId(), table_id, table_number, guests, items, lines, created_at: new Date().toISOString() };
  write([...snapshot, entry]);
  return entry;
}

export const isNetworkError = (e) => !e?.response || e.response.headers?.['x-rms-offline'] === '1';

let flushing = false;
// يرسل الطلبات المحفوظة بالترتيب. يتوقف عند أول خطأ شبكة ويعيد المحاولة لاحقًا.
// خطأ تحقق من الخادم (مثل صنف نفد) يُزيل الطلب من الطابور ويُبلغ المستخدم.
export async function flushQueue() {
  if (flushing || !navigator.onLine) return { sent: 0, failed: [] };
  const uid = currentUserId();
  const mine = snapshot.filter((q) => q.user_id === uid);
  if (!uid || !mine.length) return { sent: 0, failed: [] };
  flushing = true;
  const result = { sent: 0, failed: [] };
  try {
    for (const entry of mine) {
      try {
        const { data } = await api.post('/orders', { type: 'dine_in', table_id: entry.table_id, guests: entry.guests, items: entry.items }, { headers: { 'Idempotency-Key': entry.id } });
        try {
          await api.post(`/orders/${data.id}/send`, {}, { headers: { 'Idempotency-Key': `${entry.id}.send` } });
        } catch (e) {
          // 400 = لا توجد مسودات (أُرسلت من جهاز آخر) — يعتبر نجاحًا
          if (isNetworkError(e) || e.response.status >= 500 || e.response.status === 409) throw e;
        }
        result.sent += 1;
        write(snapshot.filter((q) => q.id !== entry.id));
      } catch (e) {
        if (isNetworkError(e) || e.response.status >= 500 || e.response.status === 409 || e.response.status === 401) break;
        result.failed.push({ entry, message: e.response?.data?.message || 'تعذّر إرسال الطلب' });
        write(snapshot.filter((q) => q.id !== entry.id));
      }
    }
  } finally {
    flushing = false;
  }
  if (result.sent || result.failed.length) window.dispatchEvent(new CustomEvent('rms-queue-flushed', { detail: result }));
  return result;
}

// حذف البيانات المحفوظة عند تسجيل الخروج (لا يراها مستخدم آخر على نفس الجهاز)
export async function clearOfflineData() {
  try { navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_API_CACHE' }); } catch { /* لا يوجد عامل خدمة */ }
  try { await caches?.delete('rms-api'); } catch { /* غير مدعوم */ }
}

export function startOfflineSync() {
  window.addEventListener('online', () => flushQueue());
  setInterval(() => flushQueue(), 15000);
  flushQueue();
}
