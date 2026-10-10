import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { errMsg } from '../api/client';
import { HOME_BY_ROLE } from '../App';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-brand"><span className="logo-dot">🍽️</span><h1>نظام إدارة المطاعم</h1></div>
        <form onSubmit={submit}>
          {error && <div className="error">{error}</div>}
          <div className="field"><label>اسم المستخدم</label><input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" /></div>
          <div className="field"><label>كلمة المرور</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></div>
          <button className="btn" style={{ width: '100%' }} disabled={loading}>{loading ? '...' : 'دخول'}</button>
        </form>
      </div>
    </div>
  );
}
