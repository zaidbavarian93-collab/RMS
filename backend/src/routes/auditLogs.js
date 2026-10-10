const express = require('express');
const { AuditLog } = require('../models');
const { authenticate, authorize, scopeRestaurant } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('owner', 'manager'));

router.get('/', async (req, res) => {
  const where = {};
  const rid = scopeRestaurant(req);
  if (rid) where.restaurant_id = rid;
  if (req.query.action) where.action = req.query.action;
  res.json(await AuditLog.findAll({ where, order: [['created_at', 'DESC']], limit: Math.min(Number(req.query.limit) || 200, 500) }));
});

module.exports = router;
