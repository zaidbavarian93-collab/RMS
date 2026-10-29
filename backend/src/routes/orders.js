const express = require('express');
const { Op } = require('sequelize');
const { sequelize, Order, OrderItem, DiningTable, Payment, PAYMENT_METHODS, ORDER_TYPES } = require('../models');
const { authenticate, authorize, scopeRestaurant } = require('../middleware/auth');
const { idempotency } = require('../middleware/idempotency');
const { logAudit } = require('../services/auditLog');
const S = require('../services/orderService');

const router = express.Router();
router.use(authenticate, authorize('owner', 'manager', 'cashier', 'captain'), idempotency);
const MANAGERS = ['owner', 'manager'];

async function findOrder(req, t) {
  const order = await Order.findOne({ where: { id: req.params.id, restaurant_id: scopeRestaurant(req) }, transaction: t, lock: t ? t.LOCK.UPDATE : undefined });
  if (!order) throw new S.HttpError(404, 'الطلب غير موجود');
  return order;
}
function assertEditable(order) {
  if (!['open', 'billing'].includes(order.status)) throw new S.HttpError(400, 'الطلب مغلق');
}

router.get('/', async (req, res) => {
  const where = { restaurant_id: scopeRestaurant(req) };
  if (req.query.status) where.status = req.query.status.split(',');
  if (req.query.table_id) where.table_id = req.query.table_id;
  if (req.query.mine === '1') where.captain_id = req.user.id;
  if (req.query.date) {
    const d = new Date(`${req.query.date}T00:00:00`);
    where.created_at = { [Op.gte]: d, [Op.lt]: new Date(d.getTime() + 86400000) };
  }
  const orders = await Order.findAll({
    where, order: [['created_at', 'DESC']], limit: Math.min(Number(req.query.limit) || 100, 300),
    include: [{ model: OrderItem, as: 'items' }, { model: DiningTable, as: 'table' }, { association: 'captain', attributes: ['id', 'full_name'] }],
  });
  res.json(orders);
});

router.get('/:id', async (req, res) => {
  const order = await S.loadOrder(req.params.id);
  if (!order || order.restaurant_id !== scopeRestaurant(req)) return res.status(404).json({ message: 'الطلب غير موجود' });
  res.json(order);
});

// فتح طلب (أو الإضافة على الطلب المفتوح لنفس الطاولة). يمكن إرسال items مباشرة
router.post('/', async (req, res) => {
  const rid = scopeRestaurant(req);
  const type = req.body.type || 'dine_in';
  if (!ORDER_TYPES.includes(type)) return res.status(400).json({ message: 'نوع الطلب غير صالح' });
  const id = await sequelize.transaction(async (t) => {
    let order;
    if (type === 'dine_in') {
      const table = await DiningTable.findOne({ where: { id: req.body.table_id, restaurant_id: rid, is_active: true }, transaction: t, lock: t.LOCK.UPDATE });
      if (!table) throw new S.HttpError(400, 'الطاولة غير صالحة');
      order = await Order.findOne({ where: { table_id: table.id, status: { [Op.in]: ['open', 'billing'] } }, transaction: t });
      if (order && order.status === 'billing') throw new S.HttpError(400, 'طُلبت الفاتورة لهذه الطاولة');
      if (!order) {
        order = await Order.create({ restaurant_id: rid, number: await S.nextOrderNumber(rid, t), type, table_id: table.id, captain_id: req.user.role === 'captain' ? req.user.id : null, guests: req.body.guests || 1 }, { transaction: t });
        await logAudit({ req, action: 'create', entityType: 'Order', entityId: order.id, description: `فتح طلب #${order.number} على الطاولة ${table.number}` });
      }
    } else {
      order = await Order.create({
        restaurant_id: rid, number: await S.nextOrderNumber(rid, t), type, captain_id: req.user.id,
        customer_name: req.body.customer_name, customer_phone: req.body.customer_phone, delivery_address: req.body.delivery_address,
      }, { transaction: t });
    }
    if (req.body.items?.length) {
      const rows = await S.buildItems(rid, req.body.items, { status: 'draft', source: req.user.role === 'captain' ? 'captain' : 'cashier' }, t);
      await OrderItem.bulkCreate(rows.map((r) => ({ ...r, order_id: order.id })), { transaction: t });
    }
    await S.recalcOrder(order.id, t);
    await S.syncTableStatus(order.table_id, t);
    return order.id;
  });
  res.status(201).json(await S.loadOrder(id));
});

router.post('/:id/items', async (req, res) => {
  await sequelize.transaction(async (t) => {
    const order = await findOrder(req, t);
    assertEditable(order);
    if (order.status === 'billing') throw new S.HttpError(400, 'طُلبت الفاتورة - أعد فتح الطلب أولًا');
    const rows = await S.buildItems(order.restaurant_id, req.body.items, { status: 'draft', source: req.user.role === 'captain' ? 'captain' : 'cashier' }, t);
    await OrderItem.bulkCreate(rows.map((r) => ({ ...r, order_id: order.id })), { transaction: t });
    await S.recalcOrder(order.id, t);
  });
  res.json(await S.loadOrder(req.params.id));
});

// إرسال المسودات إلى المطبخ (draft → pending)
router.post('/:id/send', async (req, res) => {
  await sequelize.transaction(async (t) => {
    const order = await findOrder(req, t);
    assertEditable(order);
    const [count] = await OrderItem.update({ status: 'pending', sent_at: new Date() }, { where: { order_id: order.id, status: 'draft' }, transaction: t });
    if (!count) throw new S.HttpError(400, 'لا توجد أصناف جديدة لإرسالها');
    await logAudit({ req, action: 'update', entityType: 'Order', entityId: order.id, description: `إرسال ${count} صنف للمطبخ - طلب #${order.number}` });
  });
  res.json(await S.loadOrder(req.params.id));
});

// موافقة الكابتن على صنف طلبه الزبون من QR → يُرسل مباشرة للمطبخ
router.post('/:id/items/:itemId/approve', async (req, res) => {
  await sequelize.transaction(async (t) => {
    const order = await findOrder(req, t);
    assertEditable(order);
    const item = await OrderItem.findOne({ where: { id: req.params.itemId, order_id: order.id, status: 'awaiting_approval' }, transaction: t });
    if (!item) throw new S.HttpError(404, 'الصنف غير موجود أو تمت معالجته');
    await item.update({ status: 'pending', sent_at: new Date() }, { transaction: t });
    if (!order.captain_id && req.user.role === 'captain') await order.update({ captain_id: req.user.id }, { transaction: t });
    await S.recalcOrder(order.id, t);
  });
  res.json(await S.loadOrder(req.params.id));
});

router.post('/:id/items/:itemId/cancel', async (req, res) => {
  await sequelize.transaction(async (t) => {
    const order = await findOrder(req, t);
    assertEditable(order);
    const item = await OrderItem.findOne({ where: { id: req.params.itemId, order_id: order.id }, transaction: t });
    if (!item || item.status === 'cancelled') throw new S.HttpError(404, 'الصنف غير موجود');
    const reason = (req.body.reason || '').trim();
    // بعد بدء التحضير يلزم مدير (الصنف صُرفت مواده)، وبعد الإرسال يلزم سبب للتدقيق
    if (['preparing', 'ready', 'served'].includes(item.status) && !MANAGERS.includes(req.user.role)) throw new S.HttpError(403, 'إلغاء صنف بدأ تحضيره يتطلب المدير');
    if (!['draft', 'awaiting_approval'].includes(item.status) && !reason) throw new S.HttpError(400, 'سبب الإلغاء مطلوب');
    await item.update({ status: 'cancelled', cancel_reason: reason || null }, { transaction: t });
    await S.recalcOrder(order.id, t);
    await logAudit({ req, action: 'delete', entityType: 'OrderItem', entityId: item.id, description: `إلغاء ${item.name} ×${item.quantity} - طلب #${order.number}${reason ? ` (${reason})` : ''}` });
  });
  res.json(await S.loadOrder(req.params.id));
});

router.post('/:id/discount', authorize(...MANAGERS, 'cashier'), async (req, res) => {
  const amount = Number(req.body.discount);
  if (!(amount >= 0)) return res.status(400).json({ message: 'قيمة الخصم غير صالحة' });
  await sequelize.transaction(async (t) => {
    const order = await findOrder(req, t);
    assertEditable(order);
    await order.update({ discount: amount }, { transaction: t });
    await S.recalcOrder(order.id, t);
    await logAudit({ req, action: 'update', entityType: 'Order', entityId: order.id, description: `خصم ${amount} على طلب #${order.number}` });
  });
  res.json(await S.loadOrder(req.params.id));
});

router.post('/:id/request-bill', async (req, res) => {
  await sequelize.transaction(async (t) => {
    const order = await findOrder(req, t);
    assertEditable(order);
    if (await OrderItem.count({ where: { order_id: order.id, status: 'awaiting_approval' }, transaction: t })) throw new S.HttpError(400, 'يوجد أصناف من الزبون بانتظار الموافقة');
    if (await OrderItem.count({ where: { order_id: order.id, status: 'draft' }, transaction: t })) throw new S.HttpError(400, 'يوجد أصناف لم تُرسل للمطبخ');
    await order.update({ status: 'billing' }, { transaction: t });
    await S.syncTableStatus(order.table_id, t);
  });
  res.json(await S.loadOrder(req.params.id));
});

router.post('/:id/reopen', async (req, res) => {
  await sequelize.transaction(async (t) => {
    const order = await findOrder(req, t);
    if (order.status !== 'billing') throw new S.HttpError(400, 'الطلب ليس في مرحلة الفاتورة');
    await order.update({ status: 'open' }, { transaction: t });
    await S.syncTableStatus(order.table_id, t);
  });
  res.json(await S.loadOrder(req.params.id));
});

router.post('/:id/transfer', async (req, res) => {
  await sequelize.transaction(async (t) => {
    const order = await findOrder(req, t);
    assertEditable(order);
    const target = await DiningTable.findOne({ where: { id: req.body.table_id, restaurant_id: order.restaurant_id, is_active: true }, transaction: t, lock: t.LOCK.UPDATE });
    if (!target) throw new S.HttpError(400, 'الطاولة غير صالحة');
    if (await Order.count({ where: { table_id: target.id, status: { [Op.in]: ['open', 'billing'] } }, transaction: t })) throw new S.HttpError(400, 'الطاولة المطلوبة مشغولة');
    const from = order.table_id;
    await order.update({ table_id: target.id }, { transaction: t });
    await S.syncTableStatus(from, t);
    await S.syncTableStatus(target.id, t);
    await logAudit({ req, action: 'update', entityType: 'Order', entityId: order.id, description: `نقل طلب #${order.number} إلى الطاولة ${target.number}` });
  });
  res.json(await S.loadOrder(req.params.id));
});

// الدفع: يقبل دفعات متعددة (نقد + بطاقة) ويجب أن يغطي مجموعها الإجمالي
router.post('/:id/pay', authorize(...MANAGERS, 'cashier'), async (req, res) => {
  const payments = req.body.payments || [{ method: req.body.method || 'cash', amount: req.body.amount }];
  await sequelize.transaction(async (t) => {
    const order = await findOrder(req, t);
    assertEditable(order);
    if (await OrderItem.count({ where: { order_id: order.id, status: { [Op.in]: ['draft', 'awaiting_approval'] } }, transaction: t })) throw new S.HttpError(400, 'يوجد أصناف لم تُرسل أو لم تُعتمد');
    await S.recalcOrder(order.id, t);
    await order.reload({ transaction: t });
    if (payments.some((p) => !PAYMENT_METHODS.includes(p.method) || !(Number(p.amount) > 0))) throw new S.HttpError(400, 'بيانات الدفع غير صالحة');
    const paid = S.round2(payments.reduce((s, p) => s + Number(p.amount), 0));
    if (paid < Number(order.total)) throw new S.HttpError(400, `المبلغ المدفوع (${paid}) أقل من الإجمالي (${order.total})`);
    await Payment.bulkCreate(payments.map((p) => ({ restaurant_id: order.restaurant_id, order_id: order.id, method: p.method, amount: p.amount, cashier_id: req.user.id })), { transaction: t });
    await order.update({ status: 'paid', paid_at: new Date(), cashier_id: req.user.id }, { transaction: t });
    await OrderItem.update({ status: 'served' }, { where: { order_id: order.id, status: { [Op.in]: ['pending', 'preparing', 'ready'] } }, transaction: t });
    await S.deductInventory(order, req.user.id, t);
    if (order.table_id) await DiningTable.update({ status: 'cleaning' }, { where: { id: order.table_id }, transaction: t });
    await logAudit({ req, action: 'update', entityType: 'Order', entityId: order.id, description: `دفع طلب #${order.number} - الإجمالي ${order.total}` });
  });
  res.json(await S.loadOrder(req.params.id));
});

router.post('/:id/cancel', authorize(...MANAGERS), async (req, res) => {
  const reason = (req.body.reason || '').trim();
  if (!reason) return res.status(400).json({ message: 'سبب الإلغاء مطلوب' });
  await sequelize.transaction(async (t) => {
    const order = await findOrder(req, t);
    assertEditable(order);
    await OrderItem.update({ status: 'cancelled', cancel_reason: reason }, { where: { order_id: order.id, status: { [Op.ne]: 'cancelled' } }, transaction: t });
    await order.update({ status: 'cancelled', notes: reason }, { transaction: t });
    await S.recalcOrder(order.id, t);
    await S.syncTableStatus(order.table_id, t);
    await logAudit({ req, action: 'delete', entityType: 'Order', entityId: order.id, description: `إلغاء طلب #${order.number} (${reason})` });
  });
  res.json(await S.loadOrder(req.params.id));
});

module.exports = router;
