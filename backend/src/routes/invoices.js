const express = require('express');
const { Op } = require('sequelize');
const { Order, OrderItem, DiningTable, Restaurant } = require('../models');
const { authenticate, authorize, scopeRestaurant } = require('../middleware/auth');
const { logAudit } = require('../services/auditLog');

// الفواتير: سجل الفواتير المدفوعة + عرض فاتورة واحدة للطباعة + تصدير Excel (CSV)
const router = express.Router();
router.use(authenticate, authorize('owner', 'manager', 'cashier'));

const TYPE = { dine_in: 'صالة', takeaway: 'سفري', delivery: 'توصيل' };
const METHOD = { cash: 'نقد', card: 'بطاقة', online: 'إلكتروني' };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function range(req) {
  const today = new Date().toISOString().slice(0, 10);
  const f = DATE_RE.test(req.query.from || '') ? req.query.from : today;
  const t = DATE_RE.test(req.query.to || '') ? req.query.to : f;
  return { fromStr: f, toStr: t, from: new Date(`${f}T00:00:00`), to: new Date(`${t}T23:59:59.999`) };
}

const INCLUDE = [
  { model: OrderItem, as: 'items' },
  { model: DiningTable, as: 'table', attributes: ['id', 'number'] },
  { association: 'payments' },
  { association: 'captain', attributes: ['id', 'full_name'] },
  { association: 'cashier', attributes: ['id', 'full_name'] },
];

async function findInvoices(req) {
  const { from, to } = range(req);
  const orders = await Order.findAll({
    where: { restaurant_id: scopeRestaurant(req), status: 'paid', paid_at: { [Op.between]: [from, to] } },
    include: INCLUDE,
    order: [['paid_at', 'DESC'], [{ model: OrderItem, as: 'items' }, 'created_at', 'ASC']],
    limit: 2000,
  });
  const q = String(req.query.q || '').trim();
  const method = String(req.query.method || '');
  return orders.filter((o) => {
    if (q && String(o.number) !== q && String(o.table?.number || '') !== q) return false;
    if (method && !o.payments.some((p) => p.method === method)) return false;
    return true;
  });
}

const n = (v) => Number(v || 0);
const r2 = (v) => Math.round(v * 100) / 100;

router.get('/', async (req, res) => {
  const list = await findInvoices(req);
  const totals = { count: list.length, subtotal: 0, discount: 0, service: 0, tax: 0, total: 0, by_method: {} };
  for (const o of list) {
    totals.subtotal += n(o.subtotal); totals.discount += n(o.discount); totals.service += n(o.service_amount);
    totals.tax += n(o.tax_amount); totals.total += n(o.total);
    for (const p of o.payments) totals.by_method[p.method] = r2((totals.by_method[p.method] || 0) + n(p.amount));
  }
  for (const k of ['subtotal', 'discount', 'service', 'tax', 'total']) totals[k] = r2(totals[k]);
  res.json({ invoices: list, totals });
});

// ===== التصدير إلى Excel (CSV بترميز UTF-8 مع BOM ليفتح العربية بشكل صحيح) =====
// خلية آمنة: علامات اقتباس مزدوجة، ومنع "حقن الصيغ" في Excel للنصوص التي تبدأ بـ = + - @
function cell(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(v);
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const row = (arr) => arr.map(cell).join(',');
// التاريخ والوقت بالمنطقة الزمنية لجهاز المستخدم (يرسلها المتصفح) بدل منطقة الخادم
function safeTz(tz) {
  try { if (tz) { new Intl.DateTimeFormat('en', { timeZone: tz }); return tz; } } catch { /* منطقة غير صالحة */ }
  return undefined;
}
const fmtDate = (d, tz) => new Date(d).toLocaleDateString('en-CA', { timeZone: tz });
const fmtTime = (d, tz) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz });

router.get('/export', async (req, res) => {
  const { fromStr, toStr } = range(req);
  const detail = req.query.detail === 'items';
  const tz = safeTz(String(req.query.tz || ''));
  const list = await findInvoices(req);
  const lines = [];
  if (detail) {
    lines.push(row(['رقم الفاتورة', 'التاريخ', 'الوقت', 'الطاولة', 'الصنف', 'الإضافات', 'الكمية', 'سعر الوحدة', 'المبلغ']));
    for (const o of list) {
      for (const i of o.items.filter((x) => x.status !== 'cancelled')) {
        const unit = n(i.unit_price) + (i.options || []).reduce((s, op) => s + n(op.price), 0);
        lines.push(row([o.number, fmtDate(o.paid_at, tz), fmtTime(o.paid_at, tz), o.table?.number || TYPE[o.type] || '', i.name,
          (i.options || []).map((op) => op.name).join('، '), i.quantity, r2(unit), r2(unit * i.quantity)]));
      }
    }
  } else {
    lines.push(row(['رقم الفاتورة', 'التاريخ', 'الوقت', 'النوع', 'الطاولة', 'الكابتن', 'الكاشير', 'عدد الأصناف', 'المجموع', 'الخصم', 'الخدمة', 'الضريبة', 'الإجمالي', 'طريقة الدفع', 'نقد', 'بطاقة', 'إلكتروني']));
    const sum = { subtotal: 0, discount: 0, service: 0, tax: 0, total: 0, cash: 0, card: 0, online: 0 };
    for (const o of list) {
      const by = { cash: 0, card: 0, online: 0 };
      for (const p of o.payments) by[p.method] = (by[p.method] || 0) + n(p.amount);
      const items = o.items.filter((x) => x.status !== 'cancelled').reduce((s, i) => s + i.quantity, 0);
      lines.push(row([o.number, fmtDate(o.paid_at, tz), fmtTime(o.paid_at, tz), TYPE[o.type] || o.type, o.table?.number || '', o.captain?.full_name || '', o.cashier?.full_name || '', items,
        n(o.subtotal), n(o.discount), n(o.service_amount), n(o.tax_amount), n(o.total),
        [...new Set(o.payments.map((p) => METHOD[p.method] || p.method))].join(' + '), r2(by.cash), r2(by.card), r2(by.online)]));
      sum.subtotal += n(o.subtotal); sum.discount += n(o.discount); sum.service += n(o.service_amount); sum.tax += n(o.tax_amount); sum.total += n(o.total);
      sum.cash += by.cash; sum.card += by.card; sum.online += by.online;
    }
    lines.push(row(['الإجمالي', '', '', '', '', '', '', list.length, r2(sum.subtotal), r2(sum.discount), r2(sum.service), r2(sum.tax), r2(sum.total), '', r2(sum.cash), r2(sum.card), r2(sum.online)]));
  }
  await logAudit({ req, action: 'export', entityType: 'Invoice', description: `تصدير ${list.length} فاتورة (${detail ? 'تفصيلي بالأصناف' : 'ملخص'}) من ${fromStr} إلى ${toStr}` });
  const name = `invoices${detail ? '-items' : ''}_${fromStr}_${toStr}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send(`﻿${lines.join('\r\n')}\r\n`);
});

// فاتورة واحدة مع بيانات المطعم (للطباعة والتصدير). تشمل الطلبات المفتوحة لطباعة "فاتورة مبدئية"
router.get('/:id', async (req, res) => {
  const order = await Order.findOne({
    where: { id: req.params.id, restaurant_id: scopeRestaurant(req) },
    include: INCLUDE,
    order: [[{ model: OrderItem, as: 'items' }, 'created_at', 'ASC']],
  });
  if (!order) return res.status(404).json({ message: 'الفاتورة غير موجودة' });
  const r = await Restaurant.findByPk(order.restaurant_id, {
    attributes: ['name', 'logo_path', 'phone', 'address', 'currency', 'tax_number', 'invoice_footer', 'receipt_width', 'auto_print', 'tax_percent', 'service_percent'],
  });
  res.json({ invoice: order, restaurant: r });
});

module.exports = router;
