import { useEffect, useRef, useState } from 'react';
import api, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useBrand } from '../context/BrandContext';
import BrandMark from '../components/BrandMark';
import { useToast } from '../utils/format';

const MAX_LOGO = 2 * 1024 * 1024;

export default function Settings() {
  const { user } = useAuth();
  const brand = useBrand();
  const [r, setR] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();
  const [toast, show] = useToast();
  useEffect(() => { api.get('/restaurants').then((x) => setR(x.data.find((y) => y.id === user.restaurant_id) || x.data[0])); }, [user.restaurant_id]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  if (!r) return null;
  const set = (k, v) => setR({ ...r, [k]: v });

  async function save(e) {
    e.preventDefault();
    try {
      const { data } = await api.put(`/restaurants/${r.id}`, r);
      setR(data); brand.refresh(); show('تم الحفظ');
    } catch (err) { show(errMsg(err), 'err'); }
  }

  async function uploadLogo(file) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return show('الشعار يجب أن يكون صورة PNG أو JPG أو WebP', 'err');
    if (file.size > MAX_LOGO) return show('حجم الشعار أكبر من 2 ميغابايت', 'err');
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      const { data } = await api.post(`/restaurants/${r.id}/logo`, fd);
      setR(data); brand.refresh(); show('تم تحديث الشعار');
    } catch (err) { show(errMsg(err), 'err'); setPreview(null); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function removeLogo() {
    if (!window.confirm('حذف شعار المطعم؟')) return;
    try {
      const { data } = await api.delete(`/restaurants/${r.id}/logo`);
      setR(data); setPreview(null); brand.refresh(); show('تم حذف الشعار');
    } catch (err) { show(errMsg(err), 'err'); }
  }

  const logo = preview || r.logo_path;
  return (
    <div style={{ maxWidth: 720 }}>
      <div className="card">
        <h3>هوية المطعم</h3>
        <p className="muted">الاسم والشعار يظهران في الشريط الجانبي، وشاشة الدخول، والمنيو العام للزبائن، والفواتير المطبوعة، وبطاقات QR، وتطبيق الكابتن.</p>
        <div className="brand-editor">
          <div className={`logo-drop${busy ? ' busy' : ''}`} onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); uploadLogo(e.dataTransfer.files[0]); }}>
            <BrandMark logo={logo} size={96} />
            <small>{busy ? 'جارٍ الرفع…' : 'اضغط أو اسحب صورة الشعار هنا'}</small>
          </div>
          <div className="brand-fields">
            <div className="field"><label>اسم المطعم</label><input value={r.name} maxLength={80} onChange={(e) => set('name', e.target.value)} /></div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => uploadLogo(e.target.files[0])} />
            <div className="btn-row">
              <button type="button" className="btn secondary" onClick={() => fileRef.current?.click()} disabled={busy}>{r.logo_path ? 'تغيير الشعار' : 'رفع شعار'}</button>
              {r.logo_path && <button type="button" className="btn danger" onClick={removeLogo} disabled={busy}>حذف الشعار</button>}
            </div>
            <small className="muted">PNG أو JPG أو WebP بحد أقصى 2 ميغابايت. يُفضّل مربع بخلفية شفافة (512×512).</small>
          </div>
        </div>
      </div>

      <form className="card" onSubmit={save}>
        <h3>إعدادات المطعم</h3>
        <div className="form-grid">
          <div className="field"><label>الهاتف</label><input value={r.phone || ''} onChange={(e) => set('phone', e.target.value)} /></div>
          <div className="field"><label>العنوان</label><input value={r.address || ''} onChange={(e) => set('address', e.target.value)} /></div>
          <div className="field"><label>العملة</label><input value={r.currency} onChange={(e) => set('currency', e.target.value)} /></div>
          <div className="field"><label>نسبة الخدمة %</label><input type="number" step="0.01" value={r.service_percent} onChange={(e) => set('service_percent', e.target.value)} /></div>
          <div className="field"><label>نسبة الضريبة %</label><input type="number" step="0.01" value={r.tax_percent} onChange={(e) => set('tax_percent', e.target.value)} /></div>
        </div>
        <label className="check"><input type="checkbox" checked={r.qr_ordering_enabled} onChange={(e) => set('qr_ordering_enabled', e.target.checked)} /> السماح للزبون بالطلب من المنيو عبر QR (يُعتمد من الكابتن)</label>
        <p className="muted">رابط المنيو العام: <span dir="ltr">/m/{r.slug}</span></p>

        <h3 style={{ marginTop: 18 }}>الفواتير والطباعة</h3>
        <div className="form-grid">
          <div className="field"><label>الرقم الضريبي (يظهر على الفاتورة)</label><input value={r.tax_number || ''} maxLength={40} onChange={(e) => set('tax_number', e.target.value)} /></div>
          <div className="field"><label>عرض ورق الإيصال الحراري</label>
            <select value={r.receipt_width || '80'} onChange={(e) => set('receipt_width', e.target.value)}>
              <option value="80">80 مم (الأكثر شيوعًا)</option>
              <option value="58">58 مم (طابعات صغيرة)</option>
            </select></div>
        </div>
        <div className="field"><label>ملاحظة أسفل الفاتورة</label><input value={r.invoice_footer || ''} maxLength={300} placeholder="مثال: شكرًا لزيارتكم — نسعد بخدمتكم دائمًا" onChange={(e) => set('invoice_footer', e.target.value)} /></div>
        <label className="check"><input type="checkbox" checked={r.auto_print ?? true} onChange={(e) => set('auto_print', e.target.checked)} /> طباعة الإيصال تلقائيًا بعد الدفع</label>
        <button className="btn">حفظ (يشمل اسم المطعم)</button>
      </form>
      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
    </div>
  );
}
