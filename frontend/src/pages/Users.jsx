import { useEffect, useState } from 'react';
import api, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../utils/format';

export default function Users() {
  const { user } = useAuth();
  const roles = user.role === 'owner' ? Object.keys(ROLE_LABELS) : ['cashier', 'captain', 'kitchen'];
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ full_name: '', username: '', password_hash: '', role: 'captain', base_salary: '' });
  const [error, setError] = useState('');
  const [reset, setReset] = useState(null);
  const load = () => api.get('/users').then((r) => setUsers(r.data));
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    setError('');
    try { await api.post('/users', form); setForm({ ...form, full_name: '', username: '', password_hash: '' }); load(); } catch (err) { setError(errMsg(err)); }
  }
  async function resetPw(u) {
    if (!window.confirm(`إعادة تعيين كلمة مرور ${u.full_name}؟`)) return;
    const { data } = await api.post(`/users/${u.id}/reset-password`);
    setReset({ name: u.full_name, ...data });
  }
  return (
    <div>
      {reset && <div className="card" style={{ borderColor: '#eab308' }}><h4>كلمة مرور مؤقتة لـ {reset.name}</h4><p>المستخدم: <b dir="ltr">{reset.username}</b> — كلمة المرور: <b dir="ltr">{reset.password}</b></p><p className="muted">تُعرض مرة واحدة، وسيُطلب من الموظف تغييرها عند الدخول.</p><button className="btn small secondary" onClick={() => setReset(null)}>إخفاء</button></div>}
      <div className="card">
        <h3>إضافة موظف</h3>
        {error && <div className="error">{error}</div>}
        <form className="form-grid" onSubmit={add}>
          <div className="field"><label>الاسم</label><input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div className="field"><label>اسم المستخدم</label><input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
          <div className="field"><label>كلمة المرور المؤقتة</label><input required type="password" value={form.password_hash} onChange={(e) => setForm({ ...form, password_hash: e.target.value })} /></div>
          <div className="field"><label>الدور</label><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></div>
          <div className="field"><label>الراتب الأساسي</label><input type="number" value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: e.target.value })} /></div>
          <div style={{ alignSelf: 'end' }}><button className="btn">إضافة</button></div>
        </form>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>الاسم</th><th>المستخدم</th><th>الدور</th><th>الحالة</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.full_name}</td><td dir="ltr">{u.username}</td><td>{ROLE_LABELS[u.role]}</td>
                <td><span className={`badge ${u.is_active ? 'active' : 'withdrawn'}`}>{u.is_active ? 'فعّال' : 'معطّل'}</span></td>
                <td className="btn-row">
                  {u.id !== user.id && <button className="btn small secondary" onClick={() => api.put(`/users/${u.id}`, { is_active: !u.is_active }).then(load).catch((e) => setError(errMsg(e)))}>{u.is_active ? 'تعطيل' : 'تفعيل'}</button>}
                  {u.id !== user.id && <button className="btn small secondary" onClick={() => resetPw(u).catch((e) => setError(errMsg(e)))}>إعادة كلمة المرور</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
