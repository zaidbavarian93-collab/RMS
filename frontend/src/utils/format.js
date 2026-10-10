import { useEffect, useRef, useState } from 'react';

export const ROLE_LABELS = { owner: 'مالك', manager: 'مدير', cashier: 'كاشير', captain: 'كابتن', kitchen: 'مطبخ' };
export const TABLE_STATUS = { free: 'فارغة', occupied: 'مشغولة', billing: 'فاتورة', reserved: 'محجوزة', cleaning: 'تنظيف' };
export const ITEM_STATUS = { awaiting_approval: 'بانتظار الموافقة', draft: 'مسودة', pending: 'في الانتظار', preparing: 'قيد التحضير', ready: 'جاهز', served: 'تم التقديم', cancelled: 'ملغى' };
export const ORDER_TYPE = { dine_in: 'صالة', takeaway: 'سفري', delivery: 'توصيل' };
export const STATION = { kitchen: 'المطبخ', bar: 'البار', dessert: 'الحلويات' };
export const METHOD = { cash: 'نقد', card: 'بطاقة', online: 'إلكتروني' };

export const money = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
export const itemPrice = (i) => (Number(i.unit_price ?? i.price) + (i.options || []).reduce((s, o) => s + Number(o.price || 0), 0)) * (i.quantity || 1);
export const timeAgo = (d) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000));
  return m < 1 ? 'الآن' : m < 60 ? `${m} د` : `${Math.floor(m / 60)} س ${m % 60} د`;
};

// يستدعي fn فورًا ثم كل ms مللي ثانية (تحديث شبه فوري للمطبخ والكابتن بدون WebSocket)
export function usePoll(fn, ms = 5000, deps = []) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    let stop = false;
    const run = () => { if (!stop && !document.hidden) Promise.resolve(ref.current()).catch(() => {}); };
    run();
    const id = setInterval(run, ms);
    return () => { stop = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, ...deps]);
}

export function useToast() {
  const [msg, setMsg] = useState(null);
  const timer = useRef();
  const show = (text, kind = 'ok') => {
    setMsg({ text, kind });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3500);
  };
  return [msg, show];
}
