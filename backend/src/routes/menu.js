const express = require('express');
const { MenuCategory, MenuItem } = require('../models');
const { authenticate, authorize, scopeRestaurant } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { logAudit } = require('../services/auditLog');

const router = express.Router();
router.use(authenticate);
const ADMIN = ['owner', 'manager'];

// كل الأدوار تقرأ المنيو (الكابتن والكاشير يحتاجونه لأخذ الطلب)
router.get('/', async (req, res) => {
  const rid = scopeRestaurant(req);
  const categories = await MenuCategory.findAll({
    where: { restaurant_id: rid },
    include: [{ model: MenuItem, required: false }],
    order: [['sort_order', 'ASC'], ['name_ar', 'ASC'], [MenuItem, 'sort_order', 'ASC'], [MenuItem, 'name_ar', 'ASC']],
  });
  res.json(categories);
});

router.post('/categories', authorize(...ADMIN), async (req, res) => {
  const { name_ar, name_en, station, sort_order } = req.body;
  if (!name_ar) return res.status(400).json({ message: 'اسم التصنيف مطلوب' });
  const c = await MenuCategory.create({ name_ar, name_en, station: station || 'kitchen', sort_order: sort_order || 0, restaurant_id: scopeRestaurant(req) });
  await logAudit({ req, action: 'create', entityType: 'MenuCategory', entityId: c.id, description: `إضافة تصنيف: ${c.name_ar}` });
  res.status(201).json(c);
});

router.put('/categories/:id', authorize(...ADMIN), async (req, res) => {
  const c = await MenuCategory.findOne({ where: { id: req.params.id, restaurant_id: scopeRestaurant(req) } });
  if (!c) return res.status(404).json({ message: 'التصنيف غير موجود' });
  const { name_ar, name_en, station, sort_order, is_active } = req.body;
  await c.update({ name_ar, name_en, station, sort_order, is_active });
  res.json(c);
});

router.delete('/categories/:id', authorize(...ADMIN), async (req, res) => {
  const c = await MenuCategory.findOne({ where: { id: req.params.id, restaurant_id: scopeRestaurant(req) } });
  if (!c) return res.status(404).json({ message: 'التصنيف غير موجود' });
  if (await MenuItem.count({ where: { category_id: c.id } })) return res.status(400).json({ message: 'لا يمكن حذف تصنيف فيه أصناف - عطّله بدل ذلك' });
  await c.destroy();
  res.json({ ok: true });
});

function parseJson(v, fallback) {
  if (v === undefined) return undefined;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return fallback; }
}

router.post('/items', authorize(...ADMIN), upload.single('photo'), async (req, res) => {
  const rid = scopeRestaurant(req);
  const cat = await MenuCategory.findOne({ where: { id: req.body.category_id, restaurant_id: rid } });
  if (!cat) return res.status(400).json({ message: 'التصنيف غير صالح' });
  if (!req.body.name_ar || !(Number(req.body.price) >= 0)) return res.status(400).json({ message: 'الاسم والسعر مطلوبان' });
  const item = await MenuItem.create({
    restaurant_id: rid, category_id: cat.id, name_ar: req.body.name_ar, name_en: req.body.name_en, description: req.body.description,
    price: req.body.price, prep_minutes: req.body.prep_minutes || 10,
    options: parseJson(req.body.options, []) || [], recipe: parseJson(req.body.recipe, []) || [],
    photo_path: req.file ? `/uploads/menu/${req.file.filename}` : null,
  });
  await logAudit({ req, action: 'create', entityType: 'MenuItem', entityId: item.id, description: `إضافة صنف: ${item.name_ar} (${item.price})` });
  res.status(201).json(item);
});

router.put('/items/:id', authorize(...ADMIN), upload.single('photo'), async (req, res) => {
  const item = await MenuItem.findOne({ where: { id: req.params.id, restaurant_id: scopeRestaurant(req) } });
  if (!item) return res.status(404).json({ message: 'الصنف غير موجود' });
  const b = req.body;
  const patch = {
    name_ar: b.name_ar, name_en: b.name_en, description: b.description, price: b.price, prep_minutes: b.prep_minutes,
    category_id: b.category_id, options: parseJson(b.options, undefined), recipe: parseJson(b.recipe, undefined),
    is_available: b.is_available === undefined ? undefined : b.is_available === true || b.is_available === 'true',
    is_active: b.is_active === undefined ? undefined : b.is_active === true || b.is_active === 'true',
  };
  if (req.file) patch.photo_path = `/uploads/menu/${req.file.filename}`;
  if (b.price !== undefined && Number(b.price) !== Number(item.price)) {
    await logAudit({ req, action: 'update', entityType: 'MenuItem', entityId: item.id, description: `تغيير سعر ${item.name_ar}: ${item.price} → ${b.price}` });
  }
  await item.update(patch);
  res.json(item);
});

// تبديل سريع "نفد / متوفر" - يستخدمه المطبخ والكابتن أيضًا
router.post('/items/:id/availability', authorize('owner', 'manager', 'kitchen', 'captain', 'cashier'), async (req, res) => {
  const item = await MenuItem.findOne({ where: { id: req.params.id, restaurant_id: scopeRestaurant(req) } });
  if (!item) return res.status(404).json({ message: 'الصنف غير موجود' });
  await item.update({ is_available: !!req.body.is_available });
  await logAudit({ req, action: 'update', entityType: 'MenuItem', entityId: item.id, description: `${item.name_ar}: ${item.is_available ? 'متوفر' : 'نفد'}` });
  res.json(item);
});

module.exports = router;
