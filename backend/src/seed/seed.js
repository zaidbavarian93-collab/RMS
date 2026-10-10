require('dotenv').config();
const crypto = require('crypto');
const { sequelize, Restaurant, User, Floor, DiningTable, MenuCategory, MenuItem, InventoryItem } = require('../models');

// يُعيد إنشاء الجداول ويعبّئ مطعمًا تجريبيًا: قاعات، طاولات، منيو، مخزون، وحسابات لكل دور
async function seed() {
  await sequelize.sync({ force: true });

  const r = await Restaurant.create({ name: 'مطعم النخيل', slug: 'nakheel', phone: '07700000000', address: 'بغداد - الكرادة', currency: 'IQD', tax_percent: 0, service_percent: 10 });

  const users = [
    ['owner', 'owner', 'owner123', 'المالك', null],
    ['admin', 'manager', 'admin123', 'مدير المطعم', r.id],
    ['cashier', 'cashier', 'cashier123', 'الكاشير', r.id],
    ['captain1', 'captain', 'captain123', 'الكابتن أحمد', r.id],
    ['captain2', 'captain', 'captain123', 'الكابتن علي', r.id],
    ['kitchen', 'kitchen', 'kitchen123', 'شاشة المطبخ', r.id],
  ];
  for (const [username, role, password_hash, full_name, restaurant_id] of users) {
    await User.create({ username, role, password_hash, full_name, restaurant_id, base_salary: role === 'captain' ? 600000 : 0 });
  }

  const main = await Floor.create({ restaurant_id: r.id, name: 'الصالة الرئيسية', sort_order: 1 });
  const family = await Floor.create({ restaurant_id: r.id, name: 'قسم العوائل', sort_order: 2 });
  const terrace = await Floor.create({ restaurant_id: r.id, name: 'التراس', sort_order: 3 });
  const tbl = (floor, n, seats) => DiningTable.create({ restaurant_id: r.id, floor_id: floor.id, number: String(n), seats, qr_token: crypto.randomBytes(12).toString('hex') });
  for (let i = 1; i <= 8; i++) await tbl(main, i, 4);
  for (let i = 9; i <= 14; i++) await tbl(family, i, 6);
  for (let i = 15; i <= 18; i++) await tbl(terrace, i, 2);

  const inv = {};
  for (const [key, name, unit, quantity, min] of [
    ['lamb', 'لحم غنم', 'kg', 40, 10], ['chicken', 'دجاج', 'kg', 50, 10], ['rice', 'رز', 'kg', 80, 20],
    ['bread', 'خبز صمون', 'قطعة', 200, 50], ['tea', 'شاي', 'kg', 5, 1], ['cola', 'مشروب غازي', 'علبة', 120, 24],
  ]) inv[key] = await InventoryItem.create({ restaurant_id: r.id, name, unit, quantity, min_quantity: min });

  const cats = {};
  for (const [i, [key, name, station]] of [['starters', 'المقبلات', 'kitchen'], ['grills', 'المشاوي', 'kitchen'], ['mains', 'أطباق رئيسية', 'kitchen'], ['drinks', 'المشروبات', 'bar'], ['sweets', 'الحلويات', 'dessert']].entries()) {
    cats[key] = await MenuCategory.create({ restaurant_id: r.id, name_ar: name, station, sort_order: i });
  }
  const item = (cat, name, price, extra = {}) => MenuItem.create({ restaurant_id: r.id, category_id: cats[cat].id, name_ar: name, price, ...extra });
  await item('starters', 'حمص', 3000, { prep_minutes: 5 });
  await item('starters', 'تبولة', 3500, { prep_minutes: 5 });
  await item('starters', 'سلطة عربية', 3000, { prep_minutes: 5 });
  await item('grills', 'كباب عراقي', 12000, { prep_minutes: 20, options: [{ name: 'بدون بصل', price: 0 }, { name: 'حار', price: 0 }], recipe: [{ inventory_item_id: inv.lamb.id, qty: 0.25 }, { inventory_item_id: inv.bread.id, qty: 1 }] });
  await item('grills', 'تكة لحم', 14000, { prep_minutes: 20, recipe: [{ inventory_item_id: inv.lamb.id, qty: 0.3 }] });
  await item('grills', 'نصف دجاجة مشوية', 9000, { prep_minutes: 25, options: [{ name: 'صلصة ثوم إضافية', price: 500 }], recipe: [{ inventory_item_id: inv.chicken.id, qty: 0.5 }] });
  await item('mains', 'برياني دجاج', 8000, { prep_minutes: 15, recipe: [{ inventory_item_id: inv.rice.id, qty: 0.3 }, { inventory_item_id: inv.chicken.id, qty: 0.2 }] });
  await item('mains', 'قوزي على الرز', 18000, { prep_minutes: 30, recipe: [{ inventory_item_id: inv.lamb.id, qty: 0.4 }, { inventory_item_id: inv.rice.id, qty: 0.3 }] });
  await item('drinks', 'شاي', 1000, { prep_minutes: 3, recipe: [{ inventory_item_id: inv.tea.id, qty: 0.005 }] });
  await item('drinks', 'مشروب غازي', 1500, { prep_minutes: 1, recipe: [{ inventory_item_id: inv.cola.id, qty: 1 }] });
  await item('drinks', 'عصير برتقال طبيعي', 4000, { prep_minutes: 5 });
  await item('sweets', 'كنافة', 5000, { prep_minutes: 8 });
  await item('sweets', 'بقلاوة', 4500, { prep_minutes: 3 });

  console.log('✅ تمت التعبئة. حسابات تجريبية:');
  console.log('   owner/owner123 | admin/admin123 | cashier/cashier123 | captain1/captain123 | kitchen/kitchen123');
  console.log('   المنيو العام:  /m/nakheel');
  await sequelize.close();
}

seed().catch((e) => { console.error(e); process.exit(1); });
