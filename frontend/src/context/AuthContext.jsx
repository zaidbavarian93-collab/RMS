import { createContext, useContext, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });

  async function login(username, password) {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }
  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }
  async function changePassword(current_password, new_password) {
    const { data } = await api.post('/auth/change-password', { current_password, new_password });
    localStorage.setItem('token', data.token);
    const updated = { ...user, must_change_password: false };
    localStorage.setItem('user', JSON.stringify(updated));
    setUser(updated);
  }
  return <AuthContext.Provider value={{ user, login, logout, changePassword }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
