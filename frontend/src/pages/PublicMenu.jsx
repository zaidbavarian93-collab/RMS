import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { ITEM_STATUS, itemPrice, money } from '../utils/format';
import BrandMark from '../components/BrandMark';

// المنيو العام للزبون (بدون تسجيل دخول): يُفتح من QR على الطاولة. الطلب يصل الكابتن للموافقة قبل المطبخ.
export default function PublicMenu() {
  const { slug } = useParams();
  const [sp] = useSearchParams();
  const token = sp.get('t');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [cat, setCat] = useState(null);
  const [cart, setCart] = useState([]);
  const [picking, setPicking] = useState(null);
  const [msg, setMsg] = useState('');
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    axios.get(`/api/public/menu/${slug}`, { params: { t: token } })
      .then((r) => { setData(r.data); setCat(r.data.categories[0]?.id); document.title = r.data.restaurant.name; })
      .catch(() => setErr('المطعم غير موجود'));
  }, [slug, token]);

  const refresh = () => token && axios.get('/api/public/orders/current', { params: { t: token } }).then((r) => setCurrent(r.data)).catch(() => {});
  useEffect(() => { refresh(); const id = setInterval(refresh, 8000); return () => clearInterval(id); }, [token]); // eslint-disable-line

  if (err) return <div className="pub"><p className="error">{err}</p></div>;
  if (!data) return <div className="pub"><p className="muted">...</p></div>;
  const canOrder = !!(data.table && data.restaurant.qr_ordering_enabled);

  function add(item, options = []) {
    setCart((c) => {
      const key = item.id + options.join('|');
      const hit = c.find((x) => x.key === key);
      return hit ? c.map((x) => (x === hit ? { ...x, quantity: x.quantity + 1 } : x))
        : [...c, { key, menu_item_id: item.id, name: item.name_ar, price: item.price, options: options.map((n) => ({ name: n, price: item.options.find((o) => o.name === n)?.price || 0 })), quantity: 1 }];
    });
  }
  async function submit() {
    setMsg('');
    try {
      const r = await axios.post('/api/public/orders', { table_token: token, items: cart.map((c) => ({ menu_item_id: c.menu_item_id, quantity: c.quantity, options: c.options.map((o) => o.name) })) });
      setCart([]); setMsg(r.data.message); refresh();
    } catch (e) { setMsg(e.response?.data?.message || 'تعذّر إرسال الطلب'); }
  }
  const call = (kind) => axios.post('/api/public/calls', { table_token: token, kind }).then(() => setMsg('تم إبلاغ الكابتن ✔')).catch((e) => setMsg(e.response?.data?.message || 'تعذّر الإرسال'));
  const total = cart.reduce((s, c) => s + itemPrice(c), 0);
  const active = data.categories.find((c) => c.id === cat);

  return (
    <div className="pub">
      <header className="pub-head">
        <div className="pub-brand"><BrandMark logo={data.restaurant.logo_path} size={52} /><h1>{data.restaurant.name}</h1></div>
        {data.table && <div className="badge info">طاولة {data.table.number}</div>}
      </header>
      {msg && <div className="alert" onClick={() => setMsg('')}>{msg}</div>}
      <div className="chips sticky">{data.categories.map((c) => <button key={c.id} className={`chip${cat === c.id ? ' active' : ''}`} onClick={() => setCat(c.id)}>{c.name_ar}</button>)}</div>
      <div className="pub-list">
        {active?.MenuItems.map((i) => (
          <div key={i.id} className={`pub-item${i.is_available ? '' : ' off'}`}>
            {i.photo_path && <img src={i.photo_path} alt="" />}
            <div className="pub-info"><b>{i.name_ar}</b>{i.description && <p>{i.description}</p>}<span className="price">{money(i.price)} {data.restaurant.currency}</span></div>
            {canOrder && (i.is_available
              ? <button className="btn small" onClick={() => (i.options.length ? setPicking({ item: i, chosen: [] }) : add(i))}>+</button>
              : <span className="badge withdrawn">نفد</span>)}
          </div>
        ))}
      </div>

      {data.table && (
        <div className="pub-calls">
          <button className="btn secondary" onClick={() => call('call_captain')}>🔔 نادِ الكابتن</button>
          <button className="btn secondary" onClick={() => call('water')}>💧 ماء</button>
          <button className="btn secondary" onClick={() => call('request_bill')}>🧾 الفاتورة</button>
        </div>
      )}
      {current && (
        <div className="card">
          <h4>طلبك الحالي #{current.number}</h4>
          <ul className="lines">{current.items.map((i) => <li key={i.id}>{i.quantity}× {i.name} <span className={`badge st-${i.status}`}>{ITEM_STATUS[i.status]}</span></li>)}</ul>
        </div>
      )}
      {cart.length > 0 && (
        <div className="cart-bar">
          {cart.map((c) => <div key={c.key} className="cart-line"><span>{c.name}</span><span className="qty"><button onClick={() => setCart(cart.map((x) => (x === c ? { ...x, quantity: x.quantity - 1 } : x)).filter((x) => x.quantity > 0))}>−</button><b>{c.quantity}</b><button onClick={() => setCart(cart.map((x) => (x === c ? { ...x, quantity: x.quantity + 1 } : x)))}>+</button></span></div>)}
          <button className="btn" style={{ width: '100%' }} onClick={submit}>إرسال الطلب ({money(total)})</button>
          <small className="muted">سيتأكد الكابتن من طلبك قبل التحضير</small>
        </div>
      )}
      {picking && (
        <div className="modal-backdrop" onClick={() => setPicking(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{picking.item.name_ar}</h3>
            {picking.item.options.map((o) => (
              <label key={o.name} className="check"><input type="checkbox" checked={picking.chosen.includes(o.name)} onChange={(e) => setPicking({ ...picking, chosen: e.target.checked ? [...picking.chosen, o.name] : picking.chosen.filter((n) => n !== o.name) })} /> {o.name} {Number(o.price) > 0 && <small>+{money(o.price)}</small>}</label>
            ))}
            <div className="btn-row"><button className="btn" onClick={() => { add(picking.item, picking.chosen); setPicking(null); }}>إضافة</button><button className="btn secondary" onClick={() => setPicking(null)}>إلغاء</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
