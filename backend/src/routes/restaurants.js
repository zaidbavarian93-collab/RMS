const express = require('express');
const { Restaurant } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const { logAudit } = require('../services/auditLog');
const { logoUpload, UPLOADS_ROOT } = require('../middleware/upload');

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
  if (name !== undefined && !String(name).trim()) return res.status(400).json({ message: 'اسم المطعم مطلوب' });
  await r.update({ name: name === undefined ? undefined : String(name).trim().slice(0, 80), phone, address, currency, tax_percent, service_percent, qr_ordering_enabled });
  await logAudit({ req, action: 'update', entityType: 'Restaurant', entityId: r.id, description: `تعديل إعدادات: ${r.name}` });
  res.json(r);
});

function canEdit(req) {
  return req.user.role === 'owner' || req.params.id === req.user.restaurant_id;
}

function removeLogoFile(logoPath) {
  if (!logoPath || !logoPath.startsWith('/uploads/branding/')) return;
  const file = path.join(UPLOADS_ROOT, 'branding', path.basename(logoPath));
  fs.promises.unlink(file).catch(() => {});
}

// رفع/تغيير شعار المطعم
router.post('/:id/logo', authorize('owner', 'manager'), logoUpload.single('logo'), async (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ message: 'لا تملك صلاحية' });
  if (!req.file) return res.status(400).json({ message: 'اختر صورة PNG أو JPG أو WebP (بحد أقصى 2 ميغابايت)' });
  const r = await Restaurant.findByPk(req.params.id);
  if (!r) {
    removeLogoFile(`/uploads/branding/${req.file.filename}`);
    return res.status(404).json({ message: 'الفرع غير موجود' });
  }
  const old = r.logo_path;
  await r.update({ logo_path: `/uploads/branding/${req.file.filename}` });
  removeLogoFile(old);
  await logAudit({ req, action: 'update', entityType: 'Restaurant', entityId: r.id, description: `تغيير شعار: ${r.name}` });
  res.json(r);
});

router.delete('/:id/logo', authorize('owner', 'manager'), async (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ message: 'لا تملك صلاحية' });
  const r = await Restaurant.findByPk(req.params.id);
  if (!r) return res.status(404).json({ message: 'الفرع غير موجود' });
  removeLogoFile(r.logo_path);
  await r.update({ logo_path: null });
  await logAudit({ req, action: 'update', entityType: 'Restaurant', entityId: r.id, description: `حذف شعار: ${r.name}` });
  res.json(r);
});

module.exports = router;
