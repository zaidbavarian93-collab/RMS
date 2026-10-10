import { useState } from 'react';
import api, { errMsg } from '../api/client';
import { STATION, timeAgo, usePoll, useToast } from '../utils/format';

const NEXT_LABEL = { pending: '▶ ابدأ التحضير', preparing: '✔ جاهز', ready: 'تم التقديم' };

// شاشة المطبخ (KDS): تحدّث نفسها كل 4 ثوانٍ، مجمّعة حسب الطلب، مع مؤقت لكل صنف
export default function Kitchen() {
  const [items, setItems] = useState([]);
  const [station, setStation] = useState('');
  const [toast, show] = useToast();
  const load = async () => setItems((await api.get('/kitchen', { params: { station: station || undefined } })).data);
  usePoll(load, 4000, [station]);

  async function advance(i) {
    try { await api.post(`/kitchen/items/${i.id}/advance`); load(); } catch (e) { show(errMsg(e), 'err'); }
  }
  // تجميع حسب الطلب
  const orders = Object.values(items.reduce((acc, i) => {
    (acc[i.order_id] ||= { order: i.Order, items: [] }).items.push(i);
    return acc;
  }, {}));

  return (
    <div>
      <div className="page-head">
        <h2>شاشة المطبخ</h2>
        <div className="chips">
          <button className={`chip${!station ? ' active' : ''}`} onClick={() => setStation('')}>الكل</button>
          {Object.entries(STATION).map(([k, v]) => <button key={k} className={`chip${station === k ? ' active' : ''}`} onClick={() => setStation(k)}>{v}</button>)}
        </div>
      </div>
      {!orders.length && <div className="card muted">لا توجد طلبات حاليًا 🎉</div>}
      <div className="kds-grid">
        {orders.map(({ order, items: its }) => {
          const oldest = its.reduce((m, i) => Math.min(m, new Date(i.sent_at).getTime()), Infinity);
          const late = (Date.now() - oldest) / 60000;
          return (
            <div key={order.id} className={`kds-card${late > 20 ? ' late' : late > 10 ? ' warn' : ''}`}>
              <div className="kds-head">
                <b>{order.table ? `طاولة ${order.table.number}` : `طلب #${order.number}`}</b>
                <span>#{order.number} · {timeAgo(oldest)}</span>
              </div>
              {order.captain && <small className="muted">{order.captain.full_name}</small>}
              <ul>
                {its.map((i) => (
                  <li key={i.id} className={`kds-item st-${i.status}`}>
                    <div><b>{i.quantity}× {i.name}</b>{i.options.length > 0 && <small> ({i.options.map((o) => o.name).join('، ')})</small>}{i.notes && <div className="note-line">📝 {i.notes}</div>}<small className="muted"> {STATION[i.station]}</small></div>
                    <button className={`btn small${i.status === 'ready' ? ' secondary' : ''}`} onClick={() => advance(i)}>{NEXT_LABEL[i.status]}</button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
    </div>
  );
}
