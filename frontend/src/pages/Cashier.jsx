import { useState } from 'react';
import api, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useBrand } from '../context/BrandContext';
import BrandMark from '../components/BrandMark';
import { METHOD, ORDER_TYPE, itemPrice, money, timeAgo, usePoll, useToast } from '../utils/format';

// الكاشير: كل الطلبات المفتوحة (الفواتير المطلوبة أولًا) + خصم + دفع متعدد الطرق + طباعة
export default function Cashier() {
  const { user } = useAuth();
  const brand = useBrand();
  const [orders, setOrders] = useState([]);
  const [sel, setSel] = useState(null);
  const [pays, setPays] = useState([{ method: 'cash', amount: '' }]);
  const [toast, show] = useToast();
  const load = async () => {
    const { data } = await api.get('/orders', { params: { status: 'open,billing' } });
    setOrders(data.sort((a, b) => (a.status === 'billing' ? -1 : 1) - (b.status === 'billing' ? -1 : 1)));
  };
  usePoll(load, 5000);
  const order = orders.find((o) => o.id === sel);
  const paid = pays.reduce((s, p) => s + Number(p.amount || 0), 0);

  function open(o) { setSel(o.id); setPays([{ method: 'cash', amount: String(o.total) }]); }
  async function discount() {
    const v = window.prompt('قيمة الخصم (مبلغ)', order.discount);
    if (v === null) return;
    try { await api.post(`/orders/${order.id}/discount`, { discount: Number(v) }); await load(); } catch (e) { show(errMsg(e), 'err'); }
  }
  async function pay() {
    try {
      await api.post(`/orders/${order.id}/pay`, { payments: pays.filter((p) => Number(p.amount) > 0).map((p) => ({ method: p.method, amount: Number(p.amount) })) });
      show('تم الدفع ✔');
      window.print();
      setSel(null);
      load();
    } catch (e) { show(errMsg(e), 'err'); }
  }
  async function cancelOrder() {
    const reason = window.prompt('سبب إلغاء الطلب؟');
    if (!reason) return;
    try { await api.post(`/orders/${order.id}/cancel`, { reason }); setSel(null); load(); } catch (e) { show(errMsg(e), 'err'); }
  }

  return (
    <div className="cashier-grid">
      <section className="card no-print">
        <h3>الطلبات المفتوحة</h3>
        {!orders.length && <p className="muted">لا توجد طلبات مفتوحة</p>}
        {orders.map((o) => (
          <button key={o.id} className={`order-row${sel === o.id ? ' active' : ''}`} onClick={() => open(o)}>
            <b>{o.table ? `طاولة ${o.table.number}` : ORDER_TYPE[o.type]}</b>
            <span>#{o.number} · {timeAgo(o.createdAt)}</span>
            {o.status === 'billing' && <span className="badge warn">فاتورة</span>}
            <b className="amount">{money(o.total)}</b>
          </button>
        ))}
      </section>

      <section className="card receipt">
        {!order ? <p className="muted no-print">اختر طلبًا لعرض الفاتورة</p> : (
          <>
            <div className="receipt-head"><BrandMark logo={brand.logo} size={56} /><b>{brand.name}</b><small>{new Date().toLocaleString('ar-IQ')}</small></div>
            <h3>فاتورة #{order.number} — {order.table ? `طاولة ${order.table.number}` : ORDER_TYPE[order.type]}</h3>
            <table>
              <thead><tr><th>الصنف</th><th>كمية</th><th>المبلغ</th></tr></thead>
              <tbody>
                {order.items.filter((i) => i.status !== 'cancelled').map((i) => (
                  <tr key={i.id} className={['draft', 'awaiting_approval'].includes(i.status) ? 'dim' : ''}>
                    <td>{i.name}{i.options.length > 0 && <small> ({i.options.map((o) => o.name).join('، ')})</small>}{i.status === 'awaiting_approval' && <small> — بانتظار الموافقة</small>}</td>
                    <td>{i.quantity}</td><td>{money(itemPrice(i))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="totals">
              <div><span>المجموع</span><span>{money(order.subtotal)}</span></div>
              {Number(order.discount) > 0 && <div><span>خصم</span><span>-{money(order.discount)}</span></div>}
              {Number(order.service_amount) > 0 && <div><span>خدمة</span><span>{money(order.service_amount)}</span></div>}
              {Number(order.tax_amount) > 0 && <div><span>ضريبة</span><span>{money(order.tax_amount)}</span></div>}
              <div className="grand"><span>الإجمالي</span><span>{money(order.total)}</span></div>
            </div>
            <div className="no-print">
              <h4>الدفع</h4>
              {pays.map((p, idx) => (
                <div key={idx} className="inline" style={{ marginBottom: 8 }}>
                  <select value={p.method} onChange={(e) => setPays(pays.map((x, j) => (j === idx ? { ...x, method: e.target.value } : x)))}>{Object.entries(METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  <input type="number" value={p.amount} onChange={(e) => setPays(pays.map((x, j) => (j === idx ? { ...x, amount: e.target.value } : x)))} />
                  {pays.length > 1 && <button className="btn small danger" onClick={() => setPays(pays.filter((_, j) => j !== idx))}>✕</button>}
                </div>
              ))}
              <button className="btn small secondary" onClick={() => setPays([...pays, { method: 'card', amount: '' }])}>+ تقسيم الدفع</button>
              <p>المدفوع: <b>{money(paid)}</b> · {paid >= Number(order.total) ? <>الباقي للزبون: <b>{money(paid - Number(order.total))}</b></> : <span className="neg">ناقص {money(Number(order.total) - paid)}</span>}</p>
              <div className="btn-row">
                <button className="btn" disabled={paid < Number(order.total)} onClick={pay}>✔ تأكيد الدفع وطباعة</button>
                <button className="btn secondary" onClick={discount}>خصم</button>
                {['owner', 'manager'].includes(user.role) && <button className="btn danger" onClick={cancelOrder}>إلغاء الطلب</button>}
              </div>
            </div>
          </>
        )}
      </section>
      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
    </div>
  );
}
