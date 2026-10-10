const express = require('express');
const { TableCall, DiningTable } = require('../models');
const { authenticate, authorize, scopeRestaurant } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('owner', 'manager', 'cashier', 'captain'));

router.get('/', async (req, res) => {
  res.json(await TableCall.findAll({ where: { restaurant_id: scopeRestaurant(req), status: 'open' }, include: [{ model: DiningTable, as: 'table', attributes: ['id', 'number'] }], order: [['created_at', 'ASC']] }));
});

router.post('/:id/resolve', async (req, res) => {
  const call = await TableCall.findOne({ where: { id: req.params.id, restaurant_id: scopeRestaurant(req) } });
  if (!call) return res.status(404).json({ message: 'النداء غير موجود' });
  await call.update({ status: 'resolved', resolved_by: req.user.id, resolved_at: new Date() });
  res.json(call);
});

module.exports = router;
