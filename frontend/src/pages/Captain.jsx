import { useState } from 'react';
import api from '../api/client';
import OrderPanel from '../components/OrderPanel';
import { TABLE_STATUS, money, timeAgo, usePoll, useToast } from '../utils/format';

// نظام الكابتن: خريطة الطاولات بالألوان + فتح طاولة وأخذ الطلب (مصمم للموبايل أولًا)
export default function Captain() {
  const [map, setMap] = useState({ floors: [], tables: [] });
  const [floor, setFloor] = useState('all');
  const [selected, setSelected] = useState(null);
  const [toast, show] = useToast();

  const load = async () => setMap((await api.get('/tables/map')).data);
  usePoll(load, 5000);

  const tables = map.tables.filter((t) => floor === 'all' || t.floor_id === floor);
  const sel = selected && map.tables.find((t) => t.id === selected);

  if (sel) return (
    <>
      <OrderPanel key={sel.id} table={sel} tables={map.tables} onClose={() => { setSelected(null); load(); }} onChanged={load} toast={show} />
      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
    </>
  );

  const count = (s) => map.tables.filter((t) => t.status === s).length;
  const alerts = map.tables.filter((t) => t.calls?.length || t.order?.ready || t.order?.pending_approval);

  return (
    <div>
      <div className="page-head">
        <h2>الطاولات</h2>
        <div className="legend">
          {['free', 'occupied', 'billing', 'reserved', 'cleaning'].map((s) => <span key={s} className={`badge tb-${s}`}>{TABLE_STATUS[s]} {count(s)}</span>)}
        </div>
      </div>
      {alerts.length > 0 && (
        <div className="alert warn">
          {alerts.map((t) => (
            <button key={t.id} className="alert-chip" onClick={() => setSelected(t.id)}>
              طاولة {t.number}: {t.calls?.length ? '🔔 نداء ' : ''}{t.order?.ready ? `✅ ${t.order.ready} جاهز ` : ''}{t.order?.pending_approval ? `📱 ${t.order.pending_approval} بانتظار الموافقة` : ''}
            </button>
          ))}
        </div>
      )}
      <div className="chips">
        <button className={`chip${floor === 'all' ? ' active' : ''}`} onClick={() => setFloor('all')}>الكل</button>
        {map.floors.map((f) => <button key={f.id} className={`chip${floor === f.id ? ' active' : ''}`} onClick={() => setFloor(f.id)}>{f.name}</button>)}
      </div>
      <div className="table-grid">
        {tables.map((t) => (
          <button key={t.id} className={`table-card tb-${t.status}`} onClick={() => setSelected(t.id)}>
            <div className="tn">{t.number}</div>
            <div className="ts">{TABLE_STATUS[t.status]} · {t.seats} 🪑</div>
            {t.order && <div className="to"><b>{money(t.order.total)}</b><small>{timeAgo(t.order.opened_at)}{t.order.captain ? ` · ${t.order.captain.full_name}` : ''}</small></div>}
            {(t.calls?.length > 0 || t.order?.ready > 0 || t.order?.pending_approval > 0) && (
              <div className="pins">{t.calls?.length > 0 && <span title="نداء">🔔</span>}{t.order?.ready > 0 && <span title="جاهز للتقديم">✅</span>}{t.order?.pending_approval > 0 && <span title="بانتظار الموافقة">📱</span>}</div>
            )}
          </button>
        ))}
      </div>
      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
    </div>
  );
}
