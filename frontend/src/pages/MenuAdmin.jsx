import { useEffect, useState } from 'react';
import api, { errMsg } from '../api/client';
import { STATION, money, useToast } from '../utils/format';

const EMPTY = { name_ar: '', price: '', category_id: '', description: '', prep_minutes: 10, options: [], recipe: [] };

// نظام المنيو: تصنيفات + أصناف + خيارات/إضافات + وصفة (لخصم المخزون) + صورة + نفد/متوفر
export default function MenuAdmin() {
  const [cats, setCats] = useState([]);
  const [inv, setInv] = useState([]);
  const [catForm, setCatForm] = useState({ name_ar: '', station: 'kitchen' });
  const [form, setForm] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [toast, show] = useToast();
  const load = () => api.get('/menu').then((r) => setCats(r.data));
  useEffect(() => { load(); api.get('/inventory').then((r) => setInv(r.data)); }, []);

  async function addCat(e) {
    e.preventDefault();
    try { await api.post('/menu/categories', catForm); setCatForm({ name_ar: '', station: 'kitchen' }); load(); } catch (err) { show(errMsg(err), 'err'); }
  }
  async function save(e) {
    e.preventDefault();
    const fd = new FormData();
    ['name_ar', 'price', 'category_id', 'description', 'prep_minutes'].forEach((k) => fd.append(k, form[k] ?? ''));
    fd.append('options', JSON.stringify(form.options.filter((o) => o.name)));
    fd.append('recipe', JSON.stringify(form.recipe.filter((r) => r.inventory_item_id && Number(r.qty) > 0)));
    if (photo) fd.append('photo', photo);
    try {
      if (form.id) await api.put(`/menu/items/${form.id}`, fd); else await api.post('/menu/items', fd);
      setForm(null); setPhoto(null); load(); show('تم الحفظ');
    } catch (err) { show(errMsg(err), 'err'); }
  }
  const toggle = (i, patch) => api.put(`/menu/items/${i.id}`, patch).then(load);
  const setOpt = (idx, patch) => setForm({ ...form, options: form.options.map((o, j) => (j === idx ? { ...o, ...patch } : o)) });
  const setRec = (idx, patch) => setForm({ ...form, recipe: form.recipe.map((o, j) => (j === idx ? { ...o, ...patch } : o)) });

  return (
    <div>
      <div className="card">
        <h3>التصنيفات</h3>
        <form onSubmit={addCat} className="form-grid">
          <div className="field"><label>اسم التصنيف</label><input required value={catForm.name_ar} onChange={(e) => setCatForm({ ...catForm, name_ar: e.target.value })} /></div>
          <div className="field"><label>محطة التحضير</label><select value={catForm.station} onChange={(e) => setCatForm({ ...catForm, station: e.target.value })}>{Object.entries(STATION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div style={{ alignSelf: 'end' }}><button className="btn">إضافة تصنيف</button></div>
        </form>
      </div>

      <div className="page-head"><h3>الأصناف</h3><button className="btn" disabled={!cats.length} onClick={() => setForm({ ...EMPTY, category_id: cats[0]?.id })}>+ صنف جديد</button></div>

      {form && (
        <form className="card" onSubmit={save}>
          <h3>{form.id ? 'تعديل صنف' : 'صنف جديد'}</h3>
          <div className="form-grid">
            <div className="field"><label>الاسم</label><input required value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} /></div>
            <div className="field"><label>السعر</label><input required type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
            <div className="field"><label>التصنيف</label><select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}</select></div>
            <div className="field"><label>وقت التحضير (دقيقة)</label><input type="number" value={form.prep_minutes} onChange={(e) => setForm({ ...form, prep_minutes: e.target.value })} /></div>
            <div className="field"><label>الوصف</label><input value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="field"><label>صورة (اختياري)</label><input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0])} /></div>
          </div>
          <h4>الخيارات والإضافات</h4>
          {form.options.map((o, idx) => (
            <div key={idx} className="inline" style={{ marginBottom: 6 }}>
              <input placeholder="مثال: جبن إضافي" value={o.name} onChange={(e) => setOpt(idx, { name: e.target.value })} />
              <input type="number" placeholder="سعر إضافي" value={o.price} onChange={(e) => setOpt(idx, { price: e.target.value })} style={{ width: 120 }} />
              <button type="button" className="btn small danger" onClick={() => setForm({ ...form, options: form.options.filter((_, j) => j !== idx) })}>✕</button>
            </div>
          ))}
          <button type="button" className="btn small secondary" onClick={() => setForm({ ...form, options: [...form.options, { name: '', price: 0 }] })}>+ خيار</button>
          <h4>الوصفة (تُخصم من المخزون عند الدفع)</h4>
          {form.recipe.map((r, idx) => (
            <div key={idx} className="inline" style={{ marginBottom: 6 }}>
              <select value={r.inventory_item_id} onChange={(e) => setRec(idx, { inventory_item_id: e.target.value })}><option value="">مادة…</option>{inv.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}</select>
              <input type="number" step="0.001" placeholder="الكمية للحصة" value={r.qty} onChange={(e) => setRec(idx, { qty: e.target.value })} style={{ width: 140 }} />
              <button type="button" className="btn small danger" onClick={() => setForm({ ...form, recipe: form.recipe.filter((_, j) => j !== idx) })}>✕</button>
            </div>
          ))}
          <button type="button" className="btn small secondary" onClick={() => setForm({ ...form, recipe: [...form.recipe, { inventory_item_id: '', qty: '' }] })}>+ مادة</button>
          <div className="btn-row" style={{ marginTop: 14 }}><button className="btn">حفظ</button><button type="button" className="btn secondary" onClick={() => setForm(null)}>إلغاء</button></div>
        </form>
      )}

      {cats.map((c) => (
        <div className="card" key={c.id}>
          <div className="page-head">
            <h4 style={{ margin: 0 }}>{c.name_ar} <span className="badge info">{STATION[c.station]}</span>{!c.is_active && <span className="badge withdrawn">معطّل</span>}</h4>
            <button className="btn small secondary" onClick={() => api.put(`/menu/categories/${c.id}`, { is_active: !c.is_active }).then(load)}>{c.is_active ? 'تعطيل' : 'تفعيل'}</button>
          </div>
          <table>
            <thead><tr><th>الصنف</th><th>السعر</th><th>خيارات</th><th>متوفر</th><th></th></tr></thead>
            <tbody>
              {c.MenuItems.map((i) => (
                <tr key={i.id} className={i.is_active ? '' : 'dim'}>
                  <td>{i.photo_path && <img src={i.photo_path} alt="" className="thumb" />}{i.name_ar}</td>
                  <td>{money(i.price)}</td><td>{i.options.map((o) => o.name).join('، ') || '-'}</td>
                  <td><button className={`btn small ${i.is_available ? '' : 'danger'}`} onClick={() => toggle(i, { is_available: !i.is_available })}>{i.is_available ? 'متوفر' : 'نفد'}</button></td>
                  <td className="btn-row">
                    <button className="btn small secondary" onClick={() => setForm({ ...i, options: i.options || [], recipe: i.recipe || [] })}>تعديل</button>
                    <button className="btn small secondary" onClick={() => toggle(i, { is_active: !i.is_active })}>{i.is_active ? 'إخفاء' : 'إظهار'}</button>
                  </td>
                </tr>
              ))}
              {!c.MenuItems.length && <tr><td colSpan="5" className="muted">لا أصناف</td></tr>}
            </tbody>
          </table>
        </div>
      ))}
      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
    </div>
  );
}
