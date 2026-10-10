const express = require('express');
const { Restaurant } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../services/auditLog');

const router = express.Router();
router.use(authenticate);

// المالك: كل الفروع. غيره: فرعه فقط
router.get('/', async (req, res) => {
  const where = req.user.role === 'owner' ? {} : { id: req.user.restaurant_id };
  res.json(await Restaurant.findAll({ where, order: [['name', 'ASC']] }));
});

router.post('/', authorize('owner'), async (req, res) => {
  const r = await Restaurant.create(req.body);
  await logAudit({ req, action: 'create', entityType: 'Restaurant', entityId: r.id, description: `إضافة فرع: ${r.name}` });
  res.status(201).json(r);
});

// الإعدادات (الضريبة، الخدمة، العملة، الطلب عبر QR)
router.put('/:id', authorize('owner', 'manager'), async (req, res) => {
  if (req.user.role !== 'owner' && req.params.id !== req.user.restaurant_id) return res.status(403).json({ message: 'لا تملك صلاحية' });
  const r = await Restaurant.findByPk(req.params.id);
  if (!r) return res.status(404).json({ message: 'الفرع غير موجود' });
  const { name, phone, address, currency, tax_percent, service_percent, qr_ordering_enabled } = req.body;
  await r.update({ name, phone, address, currency, tax_percent, service_percent, qr_ordering_enabled });
  await logAudit({ req, action: 'update', entityType: 'Restaurant', entityId: r.id, description: `تعديل إعدادات: ${r.name}` });
  res.json(r);
});

module.exports = router;
