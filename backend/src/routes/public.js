const express = require('express');
const { Op } = require('sequelize');
const { sequelize, Restaurant, MenuCategory, MenuItem, DiningTable, Order, OrderItem, TableCall } = require('../models');
const S = require('../services/orderService');

// مسارات عامة بلا تسجيل دخول - للزبون الذي يمسح QR على الطاولة
const router = express.Router();

// محدّد معدل بسيط في الذاكرة لكل IP (حماية من الإغراق/الطلبات الوهمية)
const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((ts) => now - ts < windowMs);
    if (arr.length >= max) return res.status(429).json({ message: 'محاولات كثيرة، حاول بعد قليل' });
    arr.push(now);
    hits.set(key, arr);
    next();
  };
}
setInterval(() => hits.clear(), 10 * 60 * 1000).unref();

async function resolveTable(token) {
  if (!token) return null;
  const table = await DiningTable.findOne({ where: { qr_token: token, is_active: true } });
  return table;
}

// هوية المطعم لشاشة الدخول وما قبلها (الاسم والشعار فقط): الفرع المحدد بـ slug أو أول فرع نشط
router.get('/branding', async (req, res) => {
  const where = { is_active: true };
  if (req.query.slug) where.slug = String(req.query.slug);
  const r = await Restaurant.findOne({ where, order: [['created_at', 'ASC']], attributes: ['name', 'logo_path', 'slug'] });
  res.json(r ? { name: r.name, logo_path: r.logo_path, slug: r.slug } : { name: null, logo_path: null });
});

// المنيو العام: التصنيفات النشطة والأصناف النشطة فقط (بدون وصفات أو تكاليف)
router.get('/menu/:slug', async (req, res) => {
  const restaurant = await Restaurant.findOne({ where: { slug: req.params.slug, is_active: true } });
  if (!restaurant) return res.status(404).json({ message: 'المطعم غير موجود' });
  const categories = await MenuCategory.findAll({
    where: { restaurant_id: restaurant.id, is_active: true },
    include: [{ model: MenuItem, required: false, where: { is_active: true }, attributes: ['id', 'name_ar', 'name_en', 'description', 'price', 'photo_path', 'options', 'is_available', 'prep_minutes'] }],
    order: [['sort_order', 'ASC'], ['name_ar', 'ASC'], [MenuItem, 'sort_order', 'ASC'], [MenuItem, 'name_ar', 'ASC']],
  });
  let table = null;
  if (req.query.t) {
    const tb = await resolveTable(req.query.t);
    if (tb && tb.restaurant_id === restaurant.id) table = { number: tb.number };
  }
  res.json({
    restaurant: { name: restaurant.name, logo_path: restaurant.logo_path, currency: restaurant.currency, phone: restaurant.phone, qr_ordering_enabled: restaurant.qr_ordering_enabled },
    table,
    categories: categories.filter((c) => c.MenuItems.length),
  });
});

// طلب الزبون من الطاولة: تدخل الأصناف بحالة "بانتظار موافقة الكابتن" ولا تصل المطبخ قبل الموافقة
router.post('/orders', rateLimit(10, 60 * 1000), async (req, res) => {
  const table = await resolveTable(req.body.table_token);
  if (!table) return res.status(400).json({ message: 'رمز الطاولة غير صالح' });
  const restaurant = await Restaurant.findByPk(table.restaurant_id);
  if (!restaurant.qr_ordering_enabled) return res.status(403).json({ message: 'الطلب عبر QR غير مفعّل - اطلب من الكابتن' });
  if (!Array.isArray(req.body.items) || req.body.items.length > 20) return res.status(400).json({ message: 'عدد الأصناف غير صالح' });

  const id = await sequelize.transaction(async (t) => {
    await DiningTable.findByPk(table.id, { transaction: t, lock: t.LOCK.UPDATE });
    let order = await Order.findOne({ where: { table_id: table.id, status: { [Op.in]: ['open', 'billing'] } }, transaction: t });
    if (order?.status === 'billing') throw new S.HttpError(400, 'تم طلب الفاتورة لهذه الطاولة');
    if (!order) {
      order = await Order.create({ restaurant_id: table.restaurant_id, number: await S.nextOrderNumber(table.restaurant_id, t), type: 'dine_in', table_id: table.id }, { transaction: t });
    }
    const rows = await S.buildItems(table.restaurant_id, req.body.items, { status: 'awaiting_approval', source: 'qr' }, t);
    await OrderItem.bulkCreate(rows.map((r) => ({ ...r, order_id: order.id })), { transaction: t });
    await S.syncTableStatus(table.id, t);
    return order.id;
  });
  res.status(201).json({ ok: true, order_number: (await Order.findByPk(id)).number, message: 'تم استلام طلبك، بانتظار تأكيد الكابتن' });
});

// حالة طلب الطاولة الحالي للزبون (تتبّع بسيط)
router.get('/orders/current', async (req, res) => {
  const table = await resolveTable(req.query.t);
  if (!table) return res.status(400).json({ message: 'رمز الطاولة غير صالح' });
  const order = await Order.findOne({ where: { table_id: table.id, status: { [Op.in]: ['open', 'billing'] } }, include: [{ model: OrderItem, as: 'items', attributes: ['id', 'name', 'quantity', 'status'] }] });
  res.json(order ? { number: order.number, status: order.status, total: order.total, items: order.items.filter((i) => i.status !== 'cancelled') } : null);
});

router.post('/calls', rateLimit(5, 60 * 1000), async (req, res) => {
  const table = await resolveTable(req.body.table_token);
  if (!table) return res.status(400).json({ message: 'رمز الطاولة غير صالح' });
  const kind = ['call_captain', 'request_bill', 'water'].includes(req.body.kind) ? req.body.kind : 'call_captain';
  const existing = await TableCall.findOne({ where: { table_id: table.id, kind, status: 'open' } });
  if (!existing) await TableCall.create({ restaurant_id: table.restaurant_id, table_id: table.id, kind });
  res.status(201).json({ ok: true });
});

module.exports = router;
