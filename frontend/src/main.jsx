import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { initGlassShine } from './utils/motion.js';
import { startOfflineSync } from './utils/offline.js';
import './index.css';

initGlassShine();
startOfflineSync();

// عامل الخدمة: يجعل النظام يفتح ويعرض آخر البيانات بدون اتصال، ويسمح بتثبيته كتطبيق.
// يعمل فقط في نسخة الإنتاج وعلى HTTPS أو localhost (شرط من المتصفحات).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('SW:', e.message)));
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
