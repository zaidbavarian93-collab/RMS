const express = require('express');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { Floor, DiningTable, Order, OrderItem, TableCall, TABLE_STATUSES } = require('../models');
const { authenticate, authorize, scopeRestaurant } = require('../middleware/auth');
const { logAudit } = require('../services/auditLog');

const router = express.Router();
router.use(authenticate);
const ADMIN = ['owner', 'manager'];

// خريطة الصالة: القاعات + الطاولات + ملخص الطلب المفتوح على كل طاولة + نداءات الزبائن
router.get('/map', async (req, res) => {
  const rid = scopeRestaurant(req);
  const floors = await Floor.findAll({ where: { restaurant_id: rid }, order: [['sort_order', 'ASC'], ['name', 'ASC']] });
  const tables = await DiningTable.findAll({ where: { restaurant_id: rid, is_active: true }, order: [['number', 'ASC']] });
  const orders = await Order.findAll({
    where: { restaurant_id: rid, status: { [Op.in]: ['open', 'billing'] }, table_id: { [Op.ne]: null } },
    include: [{ model: OrderItem, as: 'items', attributes: ['id', 'status'] }, { association: 'captain', attributes: ['id', 'full_name'] }],
  });
  const calls = await TableCall.findAll({ where: { restaurant_id: rid, status: 'open' } });
  const orderByTable = Object.fromEntries(orders.map((o) => [o.table_id, o]));
  res.json({
    floors,
    tables: tables.map((t) => {
      const o = orderByTable[t.id];
      return {
        ...t.toJSON(),
        order: o && {
          id: o.id, number: o.number, status: o.status, total: o.total, guests: o.guests, captain: o.captain,
          opened_at: o.createdAt,
          pending_approval: o.items.filter((i) => i.status === 'awaiting_approval').length,
          ready: o.items.filter((i) => i.status === 'ready').length,
        },
        calls: calls.filter((c) => c.table_id === t.id),
      };
    }),
  });
});

router.post('/floors', authorize(...ADMIN), async (req, res) => {
  const f = await Floor.create({ name: req.body.name, sort_order: req.body.sort_order || 0, restaurant_id: scopeRestaurant(req) });
  await logAudit({ req, action: 'create', entityType: 'Floor', entityId: f.id, description: `إضافة قاعة: ${f.name}` });
  res.status(201).json(f);
});

router.delete('/floors/:id', authorize(...ADMIN), async (req, res) => {
  const f = await Floor.findOne({ where: { id: req.params.id, restaurant_id: scopeRestaurant(req) } });
  if (!f) return res.status(404).json({ message: 'القاعة غير موجودة' });
  if (await DiningTable.count({ where: { floor_id: f.id } })) return res.status(400).json({ message: 'لا يمكن حذف قاعة فيها طاولات' });
  await f.destroy();
  res.json({ ok: true });
});

router.post('/', authorize(...ADMIN), async (req, res) => {
  const rid = scopeRestaurant(req);
  const floor = await Floor.findOne({ where: { id: req.body.floor_id, restaurant_id: rid } });
  if (!floor) return res.status(400).json({ message: 'القاعة غير صالحة' });
  const t = await DiningTable.create({ restaurant_id: rid, floor_id: floor.id, number: String(req.body.number), seats: req.body.seats || 4, qr_token: crypto.randomBytes(12).toString('hex') });
  await logAudit({ req, action: 'create', entityType: 'DiningTable', entityId: t.id, description: `إضافة طاولة ${t.number}` });
  res.status(201).json(t);
});

router.put('/:id', authorize(...ADMIN), async (req, res) => {
  const t = await DiningTable.findOne({ where: { id: req.params.id, restaurant_id: scopeRestaurant(req) } });
  if (!t) return res.status(404).json({ message: 'الطاولة غير موجودة' });
  const { number, seats, floor_id, is_active } = req.body;
  await t.update({ number, seats, floor_id, is_active });
  res.json(t);
});

// تغيير حالة الطاولة يدويًا (حجز / تنظيف / فارغة) - لا يُسمح بتحرير طاولة عليها طلب مفتوح
router.post('/:id/status', authorize('owner', 'manager', 'cashier', 'captain'), async (req, res) => {
  const t = await DiningTable.findOne({ where: { id: req.params.id, restaurant_id: scopeRestaurant(req) } });
  if (!t) return res.status(404).json({ message: 'الطاولة غير موجودة' });
  if (!['free', 'reserved', 'cleaning'].includes(req.body.status)) return res.status(400).json({ message: 'حالة غير صالحة' });
  if (await Order.count({ where: { table_id: t.id, status: { [Op.in]: ['open', 'billing'] } } })) return res.status(400).json({ message: 'على الطاولة طلب مفتوح' });
  await t.update({ status: req.body.status });
  res.json(t);
});

module.exports = router;
