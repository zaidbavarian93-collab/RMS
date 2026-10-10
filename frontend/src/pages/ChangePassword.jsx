import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { errMsg } from '../api/client';

export default function ChangePassword({ forced }) {
  const { user, changePassword, logout } = useAuth();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [shake, setShake] = useState(0);

  async function submit(e) {
    e.preventDefault();
    setError('');
    const fail = (m) => { setError(m); setShake((n) => n + 1); };
    if (form.next !== form.confirm) return fail('كلمتا المرور غير متطابقتين');
    try { await changePassword(form.current, form.next); } catch (err) { fail(errMsg(err)); }
  }
  return (
    <div className="lock-screen">
      <form key={shake} className={`lock-form${shake ? ' shake' : ''}`} onSubmit={submit}>
        <div className="lock-avatar">{user?.full_name?.slice(0, 1) || '🔒'}</div>
        <h1>{forced ? 'يجب تغيير كلمة المرور' : 'تغيير كلمة المرور'}</h1>
        <p className="lock-sub">{user?.full_name} — اختر كلمة مرور قوية (8 أحرف على الأقل)</p>
        <input className="lock-input" type="password" placeholder="كلمة المرور الحالية" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />
        <input className="lock-input" type="password" placeholder="كلمة المرور الجديدة" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} />
        <input className="lock-input" type="password" placeholder="تأكيد كلمة المرور" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
        <div className="lock-error" role="alert">{error}</div>
        <button className="btn" style={{ width: '100%' }}>حفظ</button>
        <button type="button" className="btn secondary" style={{ width: '100%' }} onClick={logout}>خروج</button>
      </form>
    </div>
  );
}
