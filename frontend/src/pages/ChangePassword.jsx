import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { errMsg } from '../api/client';

export default function ChangePassword({ forced }) {
  const { changePassword, logout } = useAuth();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (form.next !== form.confirm) return setError('كلمتا المرور غير متطابقتين');
    try { await changePassword(form.current, form.next); } catch (err) { setError(errMsg(err)); }
  }
  return (
    <div className="login-page">
      <div className="login-box">
        <h2 style={{ marginTop: 0 }}>{forced ? 'يجب تغيير كلمة المرور' : 'تغيير كلمة المرور'}</h2>
        <form onSubmit={submit}>
          {error && <div className="error">{error}</div>}
          <div className="field"><label>كلمة المرور الحالية</label><input type="password" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} /></div>
          <div className="field"><label>كلمة المرور الجديدة (8 أحرف على الأقل)</label><input type="password" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} /></div>
          <div className="field"><label>تأكيد كلمة المرور</label><input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} /></div>
          <button className="btn" style={{ width: '100%' }}>حفظ</button>
          <button type="button" className="btn secondary" style={{ width: '100%', marginTop: 8 }} onClick={logout}>خروج</button>
        </form>
      </div>
    </div>
  );
}
