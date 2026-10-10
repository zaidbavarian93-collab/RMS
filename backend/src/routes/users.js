const express = require('express');
const crypto = require('crypto');
const { User, ROLES } = require('../models');
const { authenticate, authorize, scopeRestaurant } = require('../middleware/auth');
const { logAudit } = require('../services/auditLog');

const router = express.Router();
router.use(authenticate, authorize('owner', 'manager'));

const SAFE = { attributes: { exclude: ['password_hash'] } };

router.get('/', async (req, res) => {
  const where = {};
  const rid = scopeRestaurant(req);
  if (rid) where.restaurant_id = rid;
  res.json(await User.findAll({ where, order: [['full_name', 'ASC']], ...SAFE }));
});

router.post('/', async (req, res) => {
  const { full_name, username, password_hash, role, phone, base_salary } = req.body;
  if (!ROLES.includes(role)) return res.status(400).json({ message: 'دور غير صالح' });
  // المدير لا يمنح دور المالك ولا دور مدير آخر - هذا للمالك فقط
  if (req.user.role === 'manager' && ['owner', 'manager'].includes(role)) return res.status(403).json({ message: 'لا تملك صلاحية إنشاء هذا الدور' });
  if (!full_name || !username || !password_hash) return res.status(400).json({ message: 'الاسم واسم المستخدم وكلمة المرور مطلوبة' });
  if (await User.findOne({ where: { username } })) return res.status(400).json({ message: 'اسم المستخدم مستخدم مسبقًا' });
  const user = await User.create({
    full_name, username, password_hash, role, phone, base_salary: base_salary || 0,
    restaurant_id: role === 'owner' ? null : scopeRestaurant(req),
    must_change_password: true,
  });
  await logAudit({ req, action: 'create', entityType: 'User', entityId: user.id, description: `إضافة مستخدم: ${user.full_name} (${role})` });
  res.status(201).json(await User.findByPk(user.id, SAFE));
});

router.put('/:id', async (req, res) => {
  const user = await User.findByPk(req.params.id);
  const rid = scopeRestaurant(req);
  if (!user || (rid && user.restaurant_id !== rid && req.user.role !== 'owner')) return res.status(404).json({ message: 'المستخدم غير موجود' });
  if (req.user.role === 'manager' && ['owner', 'manager'].includes(user.role)) return res.status(403).json({ message: 'لا تملك صلاحية تعديل هذا المستخدم' });
  const { full_name, phone, base_salary, is_active } = req.body;
  await user.update({ full_name, phone, base_salary, is_active });
  await logAudit({ req, action: 'update', entityType: 'User', entityId: user.id, description: `تعديل مستخدم: ${user.full_name}` });
  res.json(await User.findByPk(user.id, SAFE));
});

router.post('/:id/reset-password', async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });
  if (req.user.role === 'manager' && (user.restaurant_id !== req.user.restaurant_id || ['owner', 'manager'].includes(user.role))) return res.status(403).json({ message: 'لا تملك صلاحية' });
  const password = crypto.randomBytes(5).toString('hex');
  user.password_hash = password;
  user.must_change_password = true;
  await user.save();
  await logAudit({ req, action: 'update', entityType: 'User', entityId: user.id, description: `إعادة تعيين كلمة مرور: ${user.full_name}` });
  res.json({ username: user.username, password });
});

module.exports = router;
