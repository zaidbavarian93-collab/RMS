import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { errMsg } from '../api/client';
import { HOME_BY_ROLE } from '../App';
import { useClock } from '../utils/motion';

// شاشة الدخول على طريقة شاشة قفل macOS: ساعة كبيرة، حقول زجاجية، واهتزاز عند كلمة مرور خاطئة
export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const now = useClock();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(0);

  if (user) return <Navigate to={HOME_BY_ROLE[user.role] || '/'} replace />;

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const u = await login(username, password);
      navigate(HOME_BY_ROLE[u.role] || '/');
    } catch (err) {
      setError(errMsg(err, 'فشل تسجيل الدخول'));
      setShake((n) => n + 1);
      setPassword('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lock-screen">
      <div className="lock-clock">
        <div className="lock-date">{now.toLocaleDateString('ar-IQ', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <div className="lock-time">{now.toLocaleTimeString('ar-IQ', { hour: 'numeric', minute: '2-digit' }).replace(/\s?[صم]$/, '')}</div>
      </div>
      <form className="lock-form" onSubmit={submit}>
        <div className="lock-avatar">🍽️</div>
        <h1>نظام إدارة المطاعم</h1>
        <input className="lock-input" placeholder="اسم المستخدم" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
        <div key={shake} className={`lock-pass${shake ? ' shake' : ''}`}>
          <input className="lock-input" type="password" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          <button className="lock-go" disabled={loading || !username || !password} aria-label="دخول">{loading ? <span className="spinner" /> : '➜'}</button>
        </div>
        <div className="lock-error" role="alert">{error}</div>
      </form>
    </div>
  );
}
