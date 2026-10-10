import { useEffect, useState } from 'react';
import api from '../api/client';
import { ROLE_LABELS } from '../utils/format';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  useEffect(() => { api.get('/audit-logs').then((r) => setLogs(r.data)); }, []);
  return (
    <div className="card">
      <h3>سجل التدقيق</h3>
      <table>
        <thead><tr><th>الوقت</th><th>المستخدم</th><th>الإجراء</th><th>التفاصيل</th></tr></thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td>{new Date(l.createdAt).toLocaleString('ar-IQ')}</td>
              <td>{l.user_name} <small className="muted">{ROLE_LABELS[l.user_role]}</small></td>
              <td><span className="badge info">{l.action}</span></td><td>{l.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
