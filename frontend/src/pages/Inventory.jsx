import { useEffect, useState } from 'react';
import api, { errMsg } from '../api/client';
import { useToast } from '../utils/format';

const KIND = { purchase: 'شراء', consumption: 'استهلاك', waste: 'هدر', adjustment: 'تسوية' };

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: '', unit: 'kg', quantity: '', min_quantity: '', cost_per_unit: '' });
  const [moves, setMoves] = useState(null);
  const [toast, show] = useToast();
  const load = () => api.get('/inventory').then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    try { await api.post('/inventory', form); setForm({ name: '', unit: 'kg', quantity: '', min_quantity: '', cost_per_unit: '' }); load(); } catch (err) { show(errMsg(err), 'err'); }
  }
  async function move(item, kind) {
    const v = window.prompt(`${KIND[kind]} — الكمية (${item.unit})${kind === 'adjustment' ? ' (موجب أو سالب)' : ''}`);
    if (!v || !Number(v)) return;
    try { await api.post(`/inventory/${item.id}/movement`, { kind, quantity: Number(v) }); load(); } catch (err) { show(errMsg(err), 'err'); }
  }
  async function history(item) { setMoves({ item, rows: (await api.get(`/inventory/${item.id}/movements`)).data }); }

  return (
    <div>
      <div className="card">
        <h3>مادة جديدة</h3>
        <form className="form-grid" onSubmit={add}>
          <div className="field"><label>الاسم</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label>الوحدة</label><input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
          <div className="field"><label>الكمية الحالية</label><input type="number" step="0.001" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
          <div className="field"><label>الحد الأدنى</label><input type="number" step="0.001" value={form.min_quantity} onChange={(e) => setForm({ ...form, min_quantity: e.target.value })} /></div>
          <div className="field"><label>كلفة الوحدة</label><input type="number" value={form.cost_per_unit} onChange={(e) => setForm({ ...form, cost_per_unit: e.target.value })} /></div>
          <div style={{ alignSelf: 'end' }}><button className="btn">إضافة</button></div>
        </form>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>المادة</th><th>الكمية</th><th>الحد الأدنى</th><th></th></tr></thead>
          <tbody>
            {items.map((i) => {
              const low = Number(i.quantity) <= Number(i.min_quantity);
              return (
                <tr key={i.id}>
                  <td>{i.name}</td>
                  <td className={low ? 'neg' : ''}>{Number(i.quantity)} {i.unit} {low && <span className="badge withdrawn">منخفض</span>}</td>
                  <td>{Number(i.min_quantity)}</td>
                  <td className="btn-row">
                    <button className="btn small" onClick={() => move(i, 'purchase')}>+ شراء</button>
                    <button className="btn small danger" onClick={() => move(i, 'waste')}>هدر</button>
                    <button className="btn small secondary" onClick={() => move(i, 'adjustment')}>تسوية</button>
                    <button className="btn small secondary" onClick={() => history(i)}>السجل</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {moves && (
        <div className="modal-backdrop" onClick={() => setMoves(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>حركات {moves.item.name}</h3>
            <table><tbody>{moves.rows.map((m) => <tr key={m.id}><td>{KIND[m.kind]}</td><td dir="ltr">{Number(m.quantity)}</td><td>{m.reference || ''}</td><td>{new Date(m.createdAt).toLocaleString('ar-IQ')}</td></tr>)}</tbody></table>
            <button className="btn secondary" onClick={() => setMoves(null)}>إغلاق</button>
          </div>
        </div>
      )}
      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
    </div>
  );
}
