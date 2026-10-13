import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import Captain from './pages/Captain';
import Kitchen from './pages/Kitchen';
import Cashier from './pages/Cashier';
import Orders from './pages/Orders';
import Invoices from './pages/Invoices';
import MenuAdmin from './pages/MenuAdmin';
import TablesAdmin from './pages/TablesAdmin';
import Inventory from './pages/Inventory';
import Reports from './pages/Reports';
import Users from './pages/Users';
import AuditLogs from './pages/AuditLogs';
import Settings from './pages/Settings';
import PublicMenu from './pages/PublicMenu';

export const HOME_BY_ROLE = { captain: '/captain', kitchen: '/kitchen', cashier: '/cashier', manager: '/', owner: '/' };

function Protected({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.must_change_password) return <ChangePassword forced />;
  if (roles && !roles.includes(user.role)) return <Navigate to={HOME_BY_ROLE[user.role] || '/'} replace />;
  return <Layout>{children}</Layout>;
}

const ADMIN = ['owner', 'manager'];
const FLOOR = ['owner', 'manager', 'cashier', 'captain'];

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      {/* صفحات عامة للزبون - بلا تسجيل دخول */}
      <Route path="/m/:slug" element={<PublicMenu />} />
      <Route path="/login" element={<Login />} />
      <Route path="/" element={user && !ADMIN.includes(user.role) ? <Navigate to={HOME_BY_ROLE[user.role]} replace /> : <Protected roles={ADMIN}><Dashboard /></Protected>} />
      <Route path="/captain" element={<Protected roles={FLOOR}><Captain /></Protected>} />
      <Route path="/kitchen" element={<Protected roles={[...ADMIN, 'kitchen', 'captain', 'cashier']}><Kitchen /></Protected>} />
      <Route path="/cashier" element={<Protected roles={[...ADMIN, 'cashier']}><Cashier /></Protected>} />
      <Route path="/invoices" element={<Protected roles={[...ADMIN, 'cashier']}><Invoices /></Protected>} />
      <Route path="/orders" element={<Protected roles={FLOOR}><Orders /></Protected>} />
      <Route path="/menu" element={<Protected roles={ADMIN}><MenuAdmin /></Protected>} />
      <Route path="/tables" element={<Protected roles={ADMIN}><TablesAdmin /></Protected>} />
      <Route path="/inventory" element={<Protected roles={ADMIN}><Inventory /></Protected>} />
      <Route path="/reports" element={<Protected roles={[...ADMIN, 'cashier']}><Reports /></Protected>} />
      <Route path="/users" element={<Protected roles={ADMIN}><Users /></Protected>} />
      <Route path="/audit-logs" element={<Protected roles={ADMIN}><AuditLogs /></Protected>} />
      <Route path="/settings" element={<Protected roles={ADMIN}><Settings /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
