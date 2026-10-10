import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import CountUp from '../components/CountUp';
import { money, usePoll } from '../utils/format';

export default function Dashboard() {
  const [live, setLive] = useState(null);
  const [today, setToday] = useState(null);
  usePoll(async () => {
    const [l, t] = await Promise.all([api.get('/reports/live'), api.get('/reports/summary')]);
    setLive(l.data); setToday(t.data);
  }, 10000);
  if (!live || !today) return <p className="muted">...</p>;
  return (
    <div>
      <h2>لوحة التحكم</h2>
      <div className="stats">
        <div className="stat"><span>مبيعات اليوم</span><b><CountUp value={today.sales} /></b></div>
        <div className="stat"><span>فواتير اليوم</span><b><CountUp value={today.orders} /></b></div>
        <div className="stat"><span>متوسط الفاتورة</span><b><CountUp value={today.avg_ticket} /></b></div>
        <div className="stat"><span>طاولات مشغولة</span><b>{live.tables.busy} / {live.tables.total}</b></div>
        <div className="stat"><span>طلبات مفتوحة</span><b><CountUp value={live.open_orders} /></b><small>{money(live.open_value)}</small></div>
      </div>
      <div className="two-col">
        <div className="card">
          <h4>المطبخ الآن</h4>
          <div className="stats small">
            <div className="stat"><span>بالانتظار</span><b><CountUp value={live.kitchen.pending} /></b></div>
            <div className="stat"><span>قيد التحضير</span><b><CountUp value={live.kitchen.preparing} /></b></div>
            <div className="stat"><span>جاهز للتقديم</span><b><CountUp value={live.kitchen.ready} /></b></div>
            <div className="stat"><span>طلبات QR بانتظار الموافقة</span><b><CountUp value={live.kitchen.awaiting_approval} /></b></div>
          </div>
          <Link to="/kitchen">فتح شاشة المطبخ ←</Link>
        </div>
        <div className="card">
          <h4>مخزون منخفض</h4>
          {!live.low_stock.length ? <p className="muted">كل المواد فوق الحد الأدنى ✔</p> : <ul>{live.low_stock.map((i) => <li key={i.id}><b>{i.name}</b>: {i.quantity} {i.unit} (الحد {i.min_quantity})</li>)}</ul>}
          <Link to="/inventory">المخزون ←</Link>
        </div>
      </div>
    </div>
  );
}
