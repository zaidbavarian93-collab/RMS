import { Fragment, useState } from 'react';
import api from '../api/client';
import { ORDER_TYPE, money, usePoll } from '../utils/format';

const STATUS = { open: 'مفتوح', billing: 'فاتورة', paid: 'مدفوع', cancelled: 'ملغى' };
const today = () => new Date().toISOString().slice(0, 10);

export default function Orders() {
  const [date, setDate] = useState(today());
  const [orders, setOrders] = useState([]);
  const [open, setOpen] = useState(null);
  usePoll(async () => setOrders((await api.get('/orders', { params: { date } })).data), 10000, [date]);
  return (
    <div className="card">
      <div className="page-head"><h3>سجل الطلبات</h3><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 'auto' }} /></div>
      <table>
        <thead><tr><th>#</th><th>النوع</th><th>الطاولة</th><th>الكابتن</th><th>الحالة</th><th>الإجمالي</th><th>الوقت</th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <Fragment key={o.id}>
              <tr className="clickable" onClick={() => setOpen(open === o.id ? null : o.id)}>
                <td>{o.number}</td><td>{ORDER_TYPE[o.type]}</td><td>{o.table?.number || '-'}</td><td>{o.captain?.full_name || '-'}</td>
                <td><span className={`badge os-${o.status}`}>{STATUS[o.status]}</span></td><td>{money(o.total)}</td>
                <td>{new Date(o.createdAt).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}</td>
              </tr>
              {open === o.id && <tr><td colSpan="7" className="detail">{o.items.map((i) => <div key={i.id} className={i.status === 'cancelled' ? 'strike' : ''}>{i.quantity}× {i.name} — {money(Number(i.unit_price) * i.quantity)}{i.cancel_reason && ` (ملغى: ${i.cancel_reason})`}</div>)}</td></tr>}
            </Fragment>
          ))}
          {!orders.length && <tr><td colSpan="7" className="muted">لا توجد طلبات في هذا اليوم</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
