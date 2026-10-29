import { createRoot } from 'react-dom/client';
import api from '../api/client';
import { METHOD, ORDER_TYPE, itemPrice, money } from './format';

/* =====================================================================
   الفواتير: قالب الفاتورة + الطباعة (إيصال حراري 58/80 مم أو A4) + التصدير PDF
   الطباعة تتم في حاوية مستقلة #print-root فلا تتأثر بتصميم الواجهة الزجاجي.
   ===================================================================== */

const fmtDateTime = (d) => new Date(d).toLocaleString('ar-IQ', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

export function InvoiceDocument({ invoice: o, restaurant: r, variant = 'receipt' }) {
  const paid = o.status === 'paid';
  const items = (o.items || []).filter((i) => i.status !== 'cancelled' && i.status !== 'draft');
  const cur = r?.currency || '';
  const width = variant === 'receipt' ? `${r?.receipt_width || 80}mm` : undefined;
  const where = o.table ? `طاولة ${o.table.number}` : ORDER_TYPE[o.type] || '';
  const totals = [
    ['المجموع', o.subtotal],
    Number(o.discount) > 0 && ['الخصم', -Number(o.discount)],
    Number(o.service_amount) > 0 && [`الخدمة${Number(r?.service_percent) ? ` (${Number(r.service_percent)}%)` : ''}`, o.service_amount],
    Number(o.tax_amount) > 0 && [`الضريبة${Number(r?.tax_percent) ? ` (${Number(r.tax_percent)}%)` : ''}`, o.tax_amount],
  ].filter(Boolean);

  return (
    <div className={`inv inv-${variant}`} dir="rtl" style={width ? { width } : undefined}>
      <header className="inv-head">
        {r?.logo_path && <img className="inv-logo" src={r.logo_path} alt="" crossOrigin="anonymous" />}
        <div className="inv-org">
          <b className="inv-name">{r?.name}</b>
          {r?.address && <span>{r.address}</span>}
          {r?.phone && <span><bdi>{r.phone}</bdi></span>}
          {r?.tax_number && <span>الرقم الضريبي: <bdi>{r.tax_number}</bdi></span>}
        </div>
        {variant === 'a4' && (
          <div className="inv-title">
            <b>{paid ? 'فاتورة' : 'فاتورة مبدئية'}</b>
            <span>رقم <bdi>#{o.number}</bdi></span>
          </div>
        )}
      </header>

      {variant === 'receipt' && <div className="inv-kind">{paid ? `فاتورة رقم #${o.number}` : `فاتورة مبدئية #${o.number}`}</div>}

      <dl className="inv-meta">
        <div><dt>التاريخ</dt><dd>{fmtDateTime(o.paid_at || new Date())}</dd></div>
        <div><dt>الطاولة / النوع</dt><dd>{where}</dd></div>
        {o.guests > 0 && o.type === 'dine_in' && <div><dt>عدد الضيوف</dt><dd>{o.guests}</dd></div>}
        {o.captain?.full_name && <div><dt>الكابتن</dt><dd>{o.captain.full_name}</dd></div>}
        {o.cashier?.full_name && <div><dt>الكاشير</dt><dd>{o.cashier.full_name}</dd></div>}
        {o.customer_name && <div><dt>الزبون</dt><dd>{o.customer_name}{o.customer_phone ? ` · ${o.customer_phone}` : ''}</dd></div>}
      </dl>

      <table className="inv-items">
        <thead><tr><th>الصنف</th><th>الكمية</th>{variant === 'a4' && <th>السعر</th>}<th>المبلغ</th></tr></thead>
        <tbody>
          {items.map((i) => {
            const line = itemPrice(i);
            return (
              <tr key={i.id}>
                <td>{i.name}{i.options?.length > 0 && <small>{i.options.map((x) => x.name).join('، ')}</small>}{i.status === 'awaiting_approval' && <small>بانتظار الموافقة</small>}</td>
                <td className="num">{i.quantity}</td>
                {variant === 'a4' && <td className="num">{money(line / (i.quantity || 1))}</td>}
                <td className="num">{money(line)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="inv-totals">
        {totals.map(([k, v]) => <div key={k}><span>{k}</span><span className="num">{money(v)}</span></div>)}
        <div className="inv-grand"><span>الإجمالي</span><span className="num">{money(o.total)} {cur}</span></div>
      </div>

      {paid && o.payments?.length > 0 && (
        <div className="inv-pay">
          {o.payments.map((p) => <div key={p.id}><span>مدفوع — {METHOD[p.method] || p.method}</span><span className="num">{money(p.amount)}</span></div>)}
        </div>
      )}
      {!paid && <div className="inv-note">هذه فاتورة مبدئية وليست إيصال دفع</div>}

      <footer className="inv-foot">
        {r?.invoice_footer && <p>{r.invoice_footer}</p>}
        <small>RMS by Starlight</small>
      </footer>
    </div>
  );
}

// يجلب الفاتورة مع بيانات المطعم من الخادم
export async function fetchInvoice(id) {
  const { data } = await api.get(`/invoices/${id}`);
  return data;
}

// يرسم الفاتورة في حاوية مؤقتة وينتظر تحميل الصور
async function mount(node, container) {
  const root = createRoot(container);
  root.render(node);
  await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
  await Promise.all([...container.querySelectorAll('img')].map((img) => (img.complete ? null : new Promise((res) => { img.onload = res; img.onerror = res; }))));
  if (document.fonts?.ready) await document.fonts.ready;
  return root;
}

const pxToMm = (px) => (px * 25.4) / 96;

// طباعة أي مكوّن في حاوية مستقلة. pageSize: دالة تُرجع قاعدة @page بعد قياس المحتوى
export async function printNode(node, pageSize = () => '@page { size: A4; margin: 12mm; }') {
  let host = document.getElementById('print-root');
  if (!host) { host = document.createElement('div'); host.id = 'print-root'; document.body.appendChild(host); }
  host.innerHTML = '';
  const container = document.createElement('div');
  host.appendChild(container);
  // نرسمه ظاهرًا خارج الشاشة أولًا لقياس طوله (الحاوية مخفية على الشاشة وتظهر عند الطباعة فقط)
  host.style.cssText = 'display:block; position:fixed; top:0; left:-10000px; background:#fff;';
  const root = await mount(node, container);
  const page = document.createElement('style');
  page.id = 'print-page-size';
  page.textContent = pageSize(container.firstChild);
  document.head.appendChild(page);
  host.removeAttribute('style');
  document.body.classList.add('printing-doc');

  const cleanup = () => {
    document.body.classList.remove('printing-doc');
    page.remove();
    root.unmount();
    host.innerHTML = '';
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  // بعض المتصفحات لا تطلق afterprint: تنظيف احتياطي
  setTimeout(() => { if (document.body.classList.contains('printing-doc')) cleanup(); }, 60000);
}

// طباعة فاتورة: variant = 'receipt' (حراري بعرض الورق وطول المحتوى) أو 'a4'
export function printInvoice(data, variant = 'receipt') {
  const w = Number(data.restaurant?.receipt_width || 80);
  return printNode(<InvoiceDocument {...data} variant={variant} />, (el) => (variant === 'receipt'
    ? `@page { size: ${w}mm ${Math.ceil(pxToMm(el.getBoundingClientRect().height)) + 6}mm; margin: 0; }`
    : '@page { size: A4; margin: 12mm; }'));
}

// كشف الفواتير لفترة (للطباعة أو PDF)
export function InvoiceStatement({ invoices, totals, brand, from, to }) {
  return (
    <div className="inv inv-a4 inv-statement" dir="rtl">
      <header className="inv-head">
        {brand?.logo && <img className="inv-logo" src={brand.logo} alt="" crossOrigin="anonymous" />}
        <div className="inv-org"><b className="inv-name">{brand?.name}</b></div>
        <div className="inv-title"><b>كشف الفواتير</b><span>{from === to ? from : `${from} — ${to}`}</span></div>
      </header>
      <table className="inv-items">
        <thead><tr><th>#</th><th>التاريخ</th><th>الطاولة</th><th>الكاشير</th><th>الدفع</th><th>الخصم</th><th>الإجمالي</th></tr></thead>
        <tbody>
          {invoices.map((o) => (
            <tr key={o.id}>
              <td className="num">{o.number}</td>
              <td>{fmtDateTime(o.paid_at)}</td>
              <td>{o.table ? o.table.number : ORDER_TYPE[o.type]}</td>
              <td>{o.cashier?.full_name || '-'}</td>
              <td>{[...new Set(o.payments.map((p) => METHOD[p.method] || p.method))].join(' + ')}</td>
              <td className="num">{Number(o.discount) ? money(o.discount) : '-'}</td>
              <td className="num">{money(o.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="inv-totals">
        <div><span>عدد الفواتير</span><span className="num">{totals.count}</span></div>
        <div><span>المجموع قبل الإضافات</span><span className="num">{money(totals.subtotal)}</span></div>
        {totals.discount > 0 && <div><span>الخصومات</span><span className="num">-{money(totals.discount)}</span></div>}
        {totals.service > 0 && <div><span>الخدمة</span><span className="num">{money(totals.service)}</span></div>}
        {totals.tax > 0 && <div><span>الضريبة</span><span className="num">{money(totals.tax)}</span></div>}
        {Object.entries(totals.by_method || {}).map(([m, v]) => <div key={m}><span>{METHOD[m] || m}</span><span className="num">{money(v)}</span></div>)}
        <div className="inv-grand"><span>الإجمالي</span><span className="num">{money(totals.total)}</span></div>
      </div>
      <footer className="inv-foot"><small>RMS by Starlight · طُبع في {fmtDateTime(new Date())}</small></footer>
    </div>
  );
}

// يحوّل عنصرًا إلى PDF (صورة عالية الدقة)، مع تقسيم الصفحات الطويلة في A4
async function elementToPdf(el, filename, { format = 'a4', widthMm }) {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')]);
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
  const img = canvas.toDataURL('image/jpeg', 0.92);
  if (format === 'receipt') {
    const w = widthMm;
    const h = (canvas.height * w) / canvas.width;
    const pdf = new jsPDF({ unit: 'mm', format: [w, h], orientation: 'portrait' });
    pdf.addImage(img, 'JPEG', 0, 0, w, h);
    pdf.save(filename);
    return;
  }
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const margin = 10;
  const pw = 210 - margin * 2;
  const ph = 297 - margin * 2;
  const totalH = (canvas.height * pw) / canvas.width;
  let y = 0;
  while (y < totalH) {
    if (y > 0) pdf.addPage();
    pdf.addImage(img, 'JPEG', margin, margin - y, pw, totalH);
    // تغطية ما يتجاوز الهامش السفلي/العلوي من الصورة المكررة
    pdf.setFillColor(255, 255, 255);
    if (y > 0) pdf.rect(0, 0, 210, margin, 'F');
    pdf.rect(0, 297 - margin, 210, margin, 'F');
    y += ph;
  }
  pdf.save(filename);
}

// يرسم مكوّنًا خارج الشاشة ثم يصدّره PDF
export async function exportNodeToPdf(node, filename, opts = {}) {
  const container = document.createElement('div');
  container.className = 'pdf-stage';
  document.body.appendChild(container);
  const root = await mount(node, container);
  try {
    await elementToPdf(container.firstChild, filename, opts);
  } finally {
    root.unmount();
    container.remove();
  }
}

export function downloadInvoicePdf(data, variant = 'a4') {
  const name = `invoice-${data.invoice.number}${variant === 'receipt' ? '-receipt' : ''}.pdf`;
  return exportNodeToPdf(<InvoiceDocument {...data} variant={variant} />, name, { format: variant, widthMm: Number(data.restaurant?.receipt_width || 80) });
}

// تنزيل ملف من الخادم مع رمز الدخول (لتصدير Excel)
export async function downloadFile(url, params, fallbackName) {
  const res = await api.get(url, { params, responseType: 'blob' });
  const cd = res.headers['content-disposition'] || '';
  const name = (cd.match(/filename="?([^"]+)"?/) || [])[1] || fallbackName;
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
