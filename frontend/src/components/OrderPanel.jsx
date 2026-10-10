import { useCallback, useEffect, useMemo, useState } from 'react';
import api, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ITEM_STATUS, itemPrice, money, timeAgo, usePoll } from '../utils/format';

// شاشة طلب الطاولة: الطلب الحالي + إضافة أصناف من المنيو + إرسال للمطبخ + الفاتورة (مشتركة بين الكابتن والكاشير)
export default function OrderPanel({ table, tables = [], onClose, onChanged, toast }) {
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [menu, setMenu] = useState([]);
  const [cat, setCat] = useState(null);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [guests, setGuests] = useState(table.seats > 2 ? 2 : 1);
  const [picking, setPicking] = useState(null); // صنف له خيارات
  const [busy, setBusy] = useState(false);
  const [transferTo, setTransferTo] = useState('');

  const loadOrder = useCallback(async () => {
    const { data } = await api.get('/orders', { params: { table_id: table.id, status: 'open,billing' } });
    setOrder(data[0] || null);
    setLoaded(true);
  }, [table.id]);
  usePoll(loadOrder, 4000, [table.id]);
  useEffect(() => { api.get('/menu').then((r) => { setMenu(r.data.filter((c) => c.is_active)); setCat(r.data[0]?.id || null); }); }, []);

  const items = useMemo(() => {
    const q = search.trim();
    const all = menu.flatMap((c) => c.MenuItems.filter((i) => i.is_active).map((i) => ({ ...i, category_id: c.id })));
    return q ? all.filter((i) => i.name_ar.includes(q)) : all.filter((i) => i.category_id === cat);
  }, [menu, cat, search]);

  function add(item, options = []) {
    setCart((c) => {
      const key = item.id + options.join('|');
      const hit = c.find((x) => x.key === key && !x.notes);
      return hit ? c.map((x) => (x === hit ? { ...x, quantity: x.quantity + 1 } : x)) : [...c, { key, menu_item_id: item.id, name: item.name_ar, price: item.price, options: options.map((n) => ({ name: n, price: item.options.find((o) => o.name === n)?.price || 0 })), quantity: 1, notes: '' }];
    });
  }
  function tap(item) {
    if (!item.is_available) return;
    if (item.options?.length) setPicking({ item, chosen: [] });
    else add(item);
  }
  const bump = (key, d) => setCart((c) => c.map((x) => (x.key === key ? { ...x, quantity: x.quantity + d } : x)).filter((x) => x.quantity > 0));

  async function run(fn, okMsg) {
    setBusy(true);
    try { await fn(); if (okMsg) toast(okMsg); await loadOrder(); onChanged?.(); } catch (e) { toast(errMsg(e), 'err'); } finally { setBusy(false); }
  }
  const sendCart = () => run(async () => {
    const { data } = await api.post('/orders', { type: 'dine_in', table_id: table.id, guests, items: cart.map((c) => ({ menu_item_id: c.menu_item_id, quantity: c.quantity, options: c.options.map((o) => o.name), notes: c.notes })) });
    await api.post(`/orders/${data.id}/send`);
    setCart([]);
  }, 'تم إرسال الطلب للمطبخ');
  const cancelItem = (i) => {
    const needsReason = !['draft', 'awaiting_approval'].includes(i.status);
    const reason = needsReason ? window.prompt(`سبب إلغاء "${i.name}"؟`) : '';
    if (needsReason && !reason) return;
    run(() => api.post(`/orders/${order.id}/items/${i.id}/cancel`, { reason }), 'تم الإلغاء');
  };
  const cartTotal = cart.reduce((s, c) => s + itemPrice(c), 0);
  const live = order?.items.filter((i) => i.status !== 'cancelled') || [];
  const awaiting = live.filter((i) => i.status === 'awaiting_approval');
  const freeTables = tables.filter((t) => t.status === 'free' && t.id !== table.id);
  const billing = order?.status === 'billing';

  return (
    <div className="order-panel">
      <div className="order-head">
        <button className="btn small secondary" onClick={onClose}>← رجوع</button>
        <h3 style={{ margin: 0 }}>طاولة {table.number}</h3>
        {order && <span className="badge info">طلب #{order.number} · {timeAgo(order.createdAt)}</span>}
        {billing && <span className="badge warn">طُلبت الفاتورة</span>}
      </div>

      {table.calls?.length > 0 && (
        <div className="alert warn">
          🔔 الزبون ينادي ({table.calls.map((c) => ({ call_captain: 'الكابتن', request_bill: 'الفاتورة', water: 'ماء' }[c.kind])).join('، ')})
          <button className="btn small" style={{ marginInlineStart: 12 }} onClick={() => run(async () => { for (const c of table.calls) await api.post(`/calls/${c.id}/resolve`); }, 'تمت تلبية النداء')}>تمت التلبية</button>
        </div>
      )}

      {!order && loaded && ['cleaning', 'reserved'].includes(table.status) && (
        <div className="alert">الطاولة {table.status === 'cleaning' ? 'قيد التنظيف' : 'محجوزة'}.
          <button className="btn small" style={{ marginInlineStart: 12 }} onClick={() => run(() => api.post(`/tables/${table.id}/status`, { status: 'free' }), 'الطاولة فارغة')}>تحويلها إلى فارغة</button>
        </div>
      )}

      <div className="order-grid">
        <section className="card">
          <h4>الطلب الحالي</h4>
          {!loaded ? <p className="muted">...</p> : !live.length ? <p className="muted">لا توجد أصناف بعد</p> : (
            <>
              {awaiting.length > 0 && <div className="alert warn">📱 {awaiting.length} صنف من الزبون بانتظار موافقتك</div>}
              <ul className="lines">
                {live.map((i) => (
                  <li key={i.id} className={`line st-${i.status}`}>
                    <div className="line-main">
                      <b>{i.quantity}× {i.name}</b>
                      {i.options.length > 0 && <small> ({i.options.map((o) => o.name).join('، ')})</small>}
                      {i.notes && <small className="muted"> — {i.notes}</small>}
                      <div><span className={`badge st-${i.status}`}>{ITEM_STATUS[i.status]}</span>{i.source === 'qr' && <span className="badge info">QR</span>}</div>
                    </div>
                    <div className="line-actions">
                      <span>{money(itemPrice(i))}</span>
                      {i.status === 'awaiting_approval' && <button className="btn small" disabled={busy} onClick={() => run(() => api.post(`/orders/${order.id}/items/${i.id}/approve`), 'تمت الموافقة وأُرسل للمطبخ')}>موافقة ✔</button>}
                      {i.status === 'ready' && <button className="btn small" disabled={busy} onClick={() => run(() => api.post(`/kitchen/items/${i.id}/advance`), 'تم التقديم')}>قدّمت ✔</button>}
                      {!billing && <button className="btn small danger" disabled={busy} onClick={() => cancelItem(i)} title="إلغاء">✕</button>}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="totals">
                <div><span>المجموع</span><span>{money(order.subtotal)}</span></div>
                {Number(order.discount) > 0 && <div><span>خصم</span><span>-{money(order.discount)}</span></div>}
                {Number(order.service_amount) > 0 && <div><span>خدمة</span><span>{money(order.service_amount)}</span></div>}
                {Number(order.tax_amount) > 0 && <div><span>ضريبة</span><span>{money(order.tax_amount)}</span></div>}
                <div className="grand"><span>الإجمالي</span><span>{money(order.total)}</span></div>
              </div>
              <div className="btn-row">
                {!billing
                  ? <button className="btn" disabled={busy || !live.length} onClick={() => run(() => api.post(`/orders/${order.id}/request-bill`), 'تم طلب الفاتورة')}>🧾 طلب الفاتورة</button>
                  : <button className="btn secondary" disabled={busy} onClick={() => run(() => api.post(`/orders/${order.id}/reopen`), 'أُعيد فتح الطلب')}>إعادة فتح الطلب</button>}
                {freeTables.length > 0 && (
                  <span className="inline">
                    <select value={transferTo} onChange={(e) => setTransferTo(e.target.value)}>
                      <option value="">نقل إلى طاولة…</option>
                      {freeTables.map((t) => <option key={t.id} value={t.id}>طاولة {t.number}</option>)}
                    </select>
                    {transferTo && <button className="btn small" disabled={busy} onClick={() => run(async () => { await api.post(`/orders/${order.id}/transfer`, { table_id: transferTo }); onClose(); }, 'تم النقل')}>نقل</button>}
                  </span>
                )}
              </div>
            </>
          )}
        </section>

        {!billing && (
          <section className="card">
            <h4>إضافة أصناف</h4>
            <input placeholder="🔍 ابحث عن صنف" value={search} onChange={(e) => setSearch(e.target.value)} />
            {!search && <div className="chips">{menu.map((c) => <button key={c.id} className={`chip${cat === c.id ? ' active' : ''}`} onClick={() => setCat(c.id)}>{c.name_ar}</button>)}</div>}
            <div className="menu-grid">
              {items.map((i) => (
                <button key={i.id} className={`menu-tile${i.is_available ? '' : ' off'}`} onClick={() => tap(i)} disabled={!i.is_available}>
                  <b>{i.name_ar}</b><span>{money(i.price)}</span>{!i.is_available && <small>نفد</small>}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      {cart.length > 0 && (
        <div className="cart-bar">
          <div className="cart-lines">
            {cart.map((c) => (
              <div key={c.key} className="cart-line">
                <span>{c.name}{c.options.length > 0 && <small> ({c.options.map((o) => o.name).join('، ')})</small>}</span>
                <input className="note" placeholder="ملاحظة" value={c.notes} onChange={(e) => setCart((x) => x.map((y) => (y.key === c.key ? { ...y, notes: e.target.value } : y)))} />
                <span className="qty"><button onClick={() => bump(c.key, -1)}>−</button><b>{c.quantity}</b><button onClick={() => bump(c.key, 1)}>+</button></span>
              </div>
            ))}
          </div>
          <div className="cart-send">
            {!order && <label className="inline">ضيوف <input type="number" min="1" value={guests} onChange={(e) => setGuests(Number(e.target.value) || 1)} style={{ width: 70 }} /></label>}
            <button className="btn" disabled={busy} onClick={sendCart}>📤 إرسال للمطبخ ({money(cartTotal)})</button>
            <button className="btn secondary" onClick={() => setCart([])}>تفريغ</button>
          </div>
        </div>
      )}

      {picking && (
        <div className="modal-backdrop" onClick={() => setPicking(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{picking.item.name_ar}</h3>
            {picking.item.options.map((o) => (
              <label key={o.name} className="check">
                <input type="checkbox" checked={picking.chosen.includes(o.name)} onChange={(e) => setPicking({ ...picking, chosen: e.target.checked ? [...picking.chosen, o.name] : picking.chosen.filter((n) => n !== o.name) })} />
                {o.name} {Number(o.price) > 0 && <small>+{money(o.price)}</small>}
              </label>
            ))}
            <div className="btn-row"><button className="btn" onClick={() => { add(picking.item, picking.chosen); setPicking(null); }}>إضافة</button><button className="btn secondary" onClick={() => setPicking(null)}>إلغاء</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
