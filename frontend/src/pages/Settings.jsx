import { useEffect, useState } from 'react';
import api, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../utils/format';

export default function Settings() {
  const { user } = useAuth();
  const [r, setR] = useState(null);
  const [toast, show] = useToast();
  useEffect(() => { api.get('/restaurants').then((x) => setR(x.data.find((y) => y.id === user.restaurant_id) || x.data[0])); }, [user.restaurant_id]);
  if (!r) return null;
  const set = (k, v) => setR({ ...r, [k]: v });
  async function save(e) {
    e.preventDefault();
    try { await api.put(`/restaurants/${r.id}`, r); show('تم الحفظ'); } catch (err) { show(errMsg(err), 'err'); }
  }
  return (
    <form className="card" onSubmit={save} style={{ maxWidth: 640 }}>
      <h3>إعدادات المطعم</h3>
      <div className="form-grid">
        <div className="field"><label>الاسم</label><input value={r.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div className="field"><label>الهاتف</label><input value={r.phone || ''} onChange={(e) => set('phone', e.target.value)} /></div>
        <div className="field"><label>العنوان</label><input value={r.address || ''} onChange={(e) => set('address', e.target.value)} /></div>
        <div className="field"><label>العملة</label><input value={r.currency} onChange={(e) => set('currency', e.target.value)} /></div>
        <div className="field"><label>نسبة الخدمة %</label><input type="number" step="0.01" value={r.service_percent} onChange={(e) => set('service_percent', e.target.value)} /></div>
        <div className="field"><label>نسبة الضريبة %</label><input type="number" step="0.01" value={r.tax_percent} onChange={(e) => set('tax_percent', e.target.value)} /></div>
      </div>
      <label className="check"><input type="checkbox" checked={r.qr_ordering_enabled} onChange={(e) => set('qr_ordering_enabled', e.target.checked)} /> السماح للزبون بالطلب من المنيو عبر QR (يُعتمد من الكابتن)</label>
      <p className="muted">رابط المنيو العام: <span dir="ltr">/m/{r.slug}</span></p>
      <button className="btn">حفظ</button>
      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
    </form>
  );
}
