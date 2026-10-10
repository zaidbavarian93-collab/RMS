import { useEffect, useState } from 'react';
import api from '../api/client';
import { METHOD, ORDER_TYPE, money } from '../utils/format';

const today = () => new Date().toISOString().slice(0, 10);

function Bars({ rows, label, value }) {
  const max = Math.max(1, ...rows.map(value));
  return (
    <div className="bars">
      {rows.map((r, i) => (
        <div key={i} className="bar-row"><span>{label(r)}</span><div className="bar"><i style={{ width: `${(value(r) / max) * 100}%` }} /></div><b>{money(value(r))}</b></div>
      ))}
      {!rows.length && <p className="muted">لا بيانات</p>}
    </div>
  );
}

export default function Reports() {
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [d, setD] = useState(null);
  useEffect(() => { api.get('/reports/summary', { params: { from, to } }).then((r) => setD(r.data)); }, [from, to]);
  return (
    <div>
      <div className="card inline">
        <label>من <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>إلى <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      {d && (
        <>
          <div className="stats">
            <div className="stat"><span>المبيعات</span><b>{money(d.sales)}</b></div>
            <div className="stat"><span>عدد الفواتير</span><b>{d.orders}</b></div>
            <div className="stat"><span>متوسط الفاتورة</span><b>{money(d.avg_ticket)}</b></div>
            <div className="stat"><span>الخصومات</span><b>{money(d.discounts)}</b></div>
            <div className="stat"><span>أصناف ملغاة</span><b>{d.cancelled_items}</b></div>
            <div className="stat"><span>عدد الضيوف</span><b>{d.guests}</b></div>
          </div>
          <div className="two-col">
            <div className="card"><h4>الأكثر مبيعًا</h4><Bars rows={d.top_items} label={(r) => r.name} value={(r) => r.quantity} /></div>
            <div className="card"><h4>المبيعات حسب الساعة</h4><Bars rows={d.by_hour} label={(r) => `${r.hour}:00`} value={(r) => r.sales} /></div>
            <div className="card"><h4>طرق الدفع</h4><Bars rows={d.by_method} label={(r) => METHOD[r.method] || r.method} value={(r) => r.amount} /></div>
            <div className="card"><h4>نوع الطلب</h4><Bars rows={d.by_type} label={(r) => ORDER_TYPE[r.type]} value={(r) => r.sales} /></div>
            <div className="card"><h4>أداء الكباتن</h4><Bars rows={d.by_captain} label={(r) => r.captain || 'بدون كابتن'} value={(r) => r.sales} /></div>
          </div>
        </>
      )}
    </div>
  );
}
