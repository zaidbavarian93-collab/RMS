import { useEffect, useState } from 'react';
import api, { errMsg } from '../api/client';
import { useBrand } from '../context/BrandContext';
import { METHOD, ORDER_TYPE, money, useToast } from '../utils/format';
import { InvoiceDocument, InvoiceStatement, downloadFile, downloadInvoicePdf, exportNodeToPdf, fetchInvoice, printInvoice, printNode } from '../utils/invoice';

const today = () => new Date().toLocaleDateString('en-CA');

// سجل الفواتير المدفوعة: بحث وفلترة، طباعة (إيصال حراري / A4)، وتصدير PDF وExcel
export default function Invoices() {
  const brand = useBrand();
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [q, setQ] = useState('');
  const [method, setMethod] = useState('');
  const [data, setData] = useState({ invoices: [], totals: { count: 0, by_method: {} } });
  const [preview, setPreview] = useState(null); // { invoice, restaurant }
  const [busy, setBusy] = useState('');
  const [toast, show] = useToast();
  const params = { from, to, q: q.trim() || undefined, method: method || undefined };

  const load = async () => {
    try { setData((await api.get('/invoices', { params })).data); } catch (e) { show(errMsg(e), 'err'); }
  };
  useEffect(() => { load(); }, [from, to, method]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(key, fn) {
    setBusy(key);
    try { await fn(); } catch (e) { show(errMsg(e, 'تعذّر تنفيذ العملية'), 'err'); } finally { setBusy(''); }
  }
  const open = (o) => run(`open-${o.id}`, async () => setPreview(await fetchInvoice(o.id)));
  const print = (o, variant) => run(`p-${variant}-${o.id}`, async () => printInvoice(await fetchInvoice(o.id), variant));
  const pdf = (o) => run(`pdf-${o.id}`, async () => downloadInvoicePdf(await fetchInvoice(o.id), 'a4'));
  const exportCsv = (detail) => run(`csv-${detail}`, () => downloadFile('/invoices/export', { ...params, detail: detail || undefined, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }, 'invoices.csv'));
  const statement = <InvoiceStatement invoices={data.invoices} totals={data.totals} brand={brand} from={from} to={to} />;
  const t = data.totals;

  return (
    <div>
      <div className="page-head">
        <h2>الفواتير</h2>
        <div className="btn-row">
          <button className="btn secondary" disabled={!t.count || !!busy} onClick={() => exportCsv('')}>⬇ Excel (ملخص)</button>
          <button className="btn secondary" disabled={!t.count || !!busy} onClick={() => exportCsv('items')}>⬇ Excel (تفصيلي بالأصناف)</button>
          <button className="btn secondary" disabled={!t.count || !!busy} onClick={() => run('st-pdf', () => exportNodeToPdf(statement, `invoices_${from}_${to}.pdf`, { format: 'a4' }))}>⬇ PDF الكشف</button>
          <button className="btn" disabled={!t.count || !!busy} onClick={() => printNode(statement)}>🖨 طباعة الكشف</button>
        </div>
      </div>

      <div className="card inv-filters">
        <div className="field"><label>من</label><input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="field"><label>إلى</label><input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="field"><label>رقم الفاتورة أو الطاولة</label>
          <input value={q} placeholder="مثال: 12" onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} /></div>
        <div className="field"><label>طريقة الدفع</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="">الكل</option>
            {Object.entries(METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
        <button className="btn" onClick={load}>بحث</button>
      </div>

      <div className="stats">
        <div className="stat"><span>عدد الفواتير</span><b>{t.count}</b></div>
        <div className="stat"><span>الإجمالي</span><b>{money(t.total)}</b></div>
        {Object.entries(t.by_method || {}).map(([m, v]) => <div key={m} className="stat"><span>{METHOD[m] || m}</span><b>{money(v)}</b></div>)}
        {t.discount > 0 && <div className="stat"><span>الخصومات</span><b>{money(t.discount)}</b></div>}
      </div>

      <div className="card">
        <table>
          <thead><tr><th>#</th><th>التاريخ</th><th>الطاولة</th><th>الكابتن</th><th>الكاشير</th><th>الدفع</th><th>الإجمالي</th><th className="no-print">إجراءات</th></tr></thead>
          <tbody>
            {data.invoices.map((o) => (
              <tr key={o.id}>
                <td><b>{o.number}</b></td>
                <td>{new Date(o.paid_at).toLocaleString('ar-IQ', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                <td>{o.table ? o.table.number : ORDER_TYPE[o.type]}</td>
                <td>{o.captain?.full_name || '-'}</td>
                <td>{o.cashier?.full_name || '-'}</td>
                <td>{o.payments.map((p) => <span key={p.id} className="badge">{METHOD[p.method] || p.method}</span>)}</td>
                <td><b>{money(o.total)}</b></td>
                <td className="inv-actions">
                  <button className="btn small secondary" title="عرض" onClick={() => open(o)}>👁</button>
                  <button className="btn small secondary" title="طباعة إيصال حراري" disabled={!!busy} onClick={() => print(o, 'receipt')}>🧾</button>
                  <button className="btn small secondary" title="طباعة A4" disabled={!!busy} onClick={() => print(o, 'a4')}>🖨</button>
                  <button className="btn small secondary" title="تنزيل PDF" disabled={!!busy} onClick={() => pdf(o)}>{busy === `pdf-${o.id}` ? '…' : 'PDF'}</button>
                </td>
              </tr>
            ))}
            {!data.invoices.length && <tr><td colSpan="8" className="muted">لا توجد فواتير مدفوعة في هذه الفترة</td></tr>}
          </tbody>
        </table>
      </div>

      {preview && (
        <div className="modal-backdrop" onClick={() => setPreview(null)}>
          <div className="modal inv-modal" onClick={(e) => e.stopPropagation()}>
            <div className="inv-preview"><InvoiceDocument {...preview} variant="receipt" /></div>
            <div className="btn-row" style={{ justifyContent: 'center', marginTop: 12 }}>
              <button className="btn" onClick={() => printInvoice(preview, 'receipt')}>🧾 طباعة إيصال</button>
              <button className="btn secondary" onClick={() => printInvoice(preview, 'a4')}>🖨 طباعة A4</button>
              <button className="btn secondary" disabled={!!busy} onClick={() => run('pv-pdf', () => downloadInvoicePdf(preview, 'a4'))}>⬇ PDF</button>
              <button className="btn secondary" disabled={!!busy} onClick={() => run('pv-pdf-r', () => downloadInvoicePdf(preview, 'receipt'))}>⬇ PDF إيصال</button>
              <button className="btn secondary" onClick={() => setPreview(null)}>إغلاق</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
    </div>
  );
}
