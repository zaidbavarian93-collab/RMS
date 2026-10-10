import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import api, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { TABLE_STATUS, useToast } from '../utils/format';

// إدارة القاعات والطاولات + توليد وطباعة رمز QR لكل طاولة (يفتح المنيو العام مربوطًا بالطاولة)
export default function TablesAdmin() {
  const { user } = useAuth();
  const [map, setMap] = useState({ floors: [], tables: [] });
  const [slug, setSlug] = useState('');
  const [qrs, setQrs] = useState({});
  const [floorName, setFloorName] = useState('');
  const [form, setForm] = useState({ number: '', seats: 4, floor_id: '' });
  const [toast, show] = useToast();

  const load = async () => {
    const { data } = await api.get('/tables/map');
    setMap(data);
    const rs = (await api.get('/restaurants')).data;
    setSlug((rs.find((r) => r.id === user.restaurant_id) || rs[0])?.slug || '');
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!slug) return;
    map.tables.forEach(async (t) => {
      const url = `${window.location.origin}/m/${slug}?t=${t.qr_token}`;
      const img = await QRCode.toDataURL(url, { width: 220, margin: 1 });
      setQrs((q) => (q[t.id] === img ? q : { ...q, [t.id]: img }));
    });
  }, [map.tables, slug]);

  const wrap = (fn) => async (e) => { e?.preventDefault?.(); try { await fn(); await load(); } catch (err) { show(errMsg(err), 'err'); } };

  return (
    <div>
      <div className="card no-print">
        <h3>القاعات والطاولات</h3>
        <form className="inline" onSubmit={wrap(async () => { await api.post('/tables/floors', { name: floorName }); setFloorName(''); })}>
          <input placeholder="اسم قاعة جديدة" value={floorName} onChange={(e) => setFloorName(e.target.value)} required /><button className="btn">إضافة قاعة</button>
        </form>
        <div className="chips">{map.floors.map((f) => <span key={f.id} className="chip">{f.name} <button className="x" onClick={wrap(() => api.delete(`/tables/floors/${f.id}`))}>✕</button></span>)}</div>
        <form className="form-grid" onSubmit={wrap(async () => { await api.post('/tables', form); setForm({ ...form, number: '' }); })}>
          <div className="field"><label>رقم الطاولة</label><input required value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></div>
          <div className="field"><label>المقاعد</label><input type="number" min="1" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} /></div>
          <div className="field"><label>القاعة</label><select required value={form.floor_id} onChange={(e) => setForm({ ...form, floor_id: e.target.value })}><option value="">اختر…</option>{map.floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
          <div style={{ alignSelf: 'end' }}><button className="btn">إضافة طاولة</button></div>
        </form>
        <button className="btn secondary" onClick={() => window.print()}>🖨️ طباعة رموز QR</button>
        {slug && <p className="muted">رابط المنيو العام: <a href={`/m/${slug}`} target="_blank" rel="noreferrer" dir="ltr">{window.location.origin}/m/{slug}</a></p>}
      </div>
      <div className="qr-grid">
        {map.floors.map((f) => map.tables.filter((t) => t.floor_id === f.id).map((t) => (
          <div className="qr-card" key={t.id}>
            <h2>طاولة {t.number}</h2>
            {qrs[t.id] ? <img src={qrs[t.id]} alt={`QR ${t.number}`} /> : <div style={{ height: 220 }} />}
            <small>امسح للاطلاع على المنيو والطلب · {f.name}</small>
            <span className="no-print badge">{TABLE_STATUS[t.status]} · {t.seats} مقاعد</span>
          </div>
        )))}
      </div>
      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
    </div>
  );
}
