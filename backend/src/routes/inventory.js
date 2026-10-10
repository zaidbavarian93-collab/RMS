const express = require('express');
const { sequelize, InventoryItem, StockMovement } = require('../models');
const { authenticate, authorize, scopeRestaurant } = require('../middleware/auth');
const { logAudit } = require('../services/auditLog');

const router = express.Router();
router.use(authenticate, authorize('owner', 'manager'));

router.get('/', async (req, res) => {
  res.json(await InventoryItem.findAll({ where: { restaurant_id: scopeRestaurant(req) }, order: [['name', 'ASC']] }));
});

router.post('/', async (req, res) => {
  if (!req.body.name) return res.status(400).json({ message: 'الاسم مطلوب' });
  const { name, unit, quantity, min_quantity, cost_per_unit, supplier } = req.body;
  const item = await InventoryItem.create({ name, unit, quantity: quantity || 0, min_quantity, cost_per_unit, supplier, restaurant_id: scopeRestaurant(req) });
  await logAudit({ req, action: 'create', entityType: 'InventoryItem', entityId: item.id, description: `إضافة مادة مخزنية: ${item.name}` });
  res.status(201).json(item);
});

router.put('/:id', async (req, res) => {
  const item = await InventoryItem.findOne({ where: { id: req.params.id, restaurant_id: scopeRestaurant(req) } });
  if (!item) return res.status(404).json({ message: 'المادة غير موجودة' });
  const { name, unit, min_quantity, cost_per_unit, supplier } = req.body;
  await item.update({ name, unit, min_quantity, cost_per_unit, supplier });
  res.json(item);
});

// حركة مخزون: purchase (+) | waste (-) | adjustment (±)
router.post('/:id/movement', async (req, res) => {
  const { kind, quantity } = req.body;
  const q = Number(quantity);
  if (!['purchase', 'waste', 'adjustment'].includes(kind) || !q) return res.status(400).json({ message: 'بيانات الحركة غير صالحة' });
  const signed = kind === 'waste' ? -Math.abs(q) : kind === 'purchase' ? Math.abs(q) : q;
  const item = await sequelize.transaction(async (t) => {
    const it = await InventoryItem.findOne({ where: { id: req.params.id, restaurant_id: scopeRestaurant(req) }, transaction: t, lock: t.LOCK.UPDATE });
    if (!it) return null;
    await it.update({ quantity: Number(it.quantity) + signed }, { transaction: t });
    await StockMovement.create({ restaurant_id: it.restaurant_id, inventory_item_id: it.id, kind, quantity: signed, reference: req.body.reference, user_id: req.user.id }, { transaction: t });
    return it;
  });
  if (!item) return res.status(404).json({ message: 'المادة غير موجودة' });
  await logAudit({ req, action: 'update', entityType: 'InventoryItem', entityId: item.id, description: `${kind} ${signed} ${item.unit} - ${item.name}` });
  res.json(item);
});

router.get('/:id/movements', async (req, res) => {
  res.json(await StockMovement.findAll({ where: { inventory_item_id: req.params.id, restaurant_id: scopeRestaurant(req) }, order: [['created_at', 'DESC']], limit: 100 }));
});

module.exports = router;
