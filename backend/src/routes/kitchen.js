const express = require('express');
const { Op } = require('sequelize');
const { OrderItem, Order, DiningTable } = require('../models');
const { authenticate, authorize, scopeRestaurant } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('owner', 'manager', 'kitchen', 'captain', 'cashier'));

const NEXT = { pending: 'preparing', preparing: 'ready', ready: 'served' };

// شاشة المطبخ (KDS): الأصناف المرسلة وغير المسلّمة، مرتبة بوقت الإرسال، ويمكن فلترتها بالمحطة
router.get('/', async (req, res) => {
  const statuses = req.query.status ? req.query.status.split(',') : ['pending', 'preparing', 'ready'];
  const where = { status: { [Op.in]: statuses } };
  if (req.query.station) where.station = req.query.station;
  const items = await OrderItem.findAll({
    where, order: [['sent_at', 'ASC']],
    include: [{ model: Order, required: true, where: { restaurant_id: scopeRestaurant(req), status: { [Op.in]: ['open', 'billing'] } }, include: [{ model: DiningTable, as: 'table', attributes: ['id', 'number'] }, { association: 'captain', attributes: ['id', 'full_name'] }] }],
  });
  res.json(items);
});

router.post('/items/:id/advance', async (req, res) => {
  const item = await OrderItem.findByPk(req.params.id, { include: [Order] });
  if (!item || item.Order.restaurant_id !== scopeRestaurant(req)) return res.status(404).json({ message: 'الصنف غير موجود' });
  const next = NEXT[item.status];
  if (!next) return res.status(400).json({ message: 'لا يمكن تغيير حالة هذا الصنف' });
  // التسليم للزبون (served) يؤكده الكابتن/الكاشير وليس المطبخ
  if (next === 'served' && req.user.role === 'kitchen') return res.status(403).json({ message: 'التسليم يؤكده الكابتن' });
  await item.update({ status: next, ready_at: next === 'ready' ? new Date() : item.ready_at });
  res.json(item);
});

module.exports = router;
