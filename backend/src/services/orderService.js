const { Op } = require('sequelize');
const { Order, OrderItem, DiningTable, MenuItem, MenuCategory, InventoryItem, StockMovement, Restaurant } = require('../models');

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// عناصر الطلب التي تدخل في الحساب: كل ما ليس ملغيًا وليس بانتظار موافقة الكابتن
const BILLABLE = (i) => !['cancelled', 'awaiting_approval'].includes(i.status);

function itemLineTotal(item) {
  const optionsTotal = (item.options || []).reduce((s, o) => s + Number(o.price || 0), 0);
  return (Number(item.unit_price) + optionsTotal) * item.quantity;
}

// حساب المجاميع: subtotal - discount ثم نسبة الخدمة (للأكل بالصالة فقط) ثم الضريبة على (الصافي + الخدمة)
async function recalcOrder(orderId, t) {
  const order = await Order.findByPk(orderId, { include: [{ model: OrderItem, as: 'items' }], transaction: t });
  const restaurant = await Restaurant.findByPk(order.restaurant_id, { transaction: t });
  const subtotal = round2(order.items.filter(BILLABLE).reduce((s, i) => s + itemLineTotal(i), 0));
  const discount = Math.min(Number(order.discount), subtotal);
  const base = subtotal - discount;
  const service = order.type === 'dine_in' ? round2((base * Number(restaurant.service_percent)) / 100) : 0;
  const tax = round2(((base + service) * Number(restaurant.tax_percent)) / 100);
  await order.update({ subtotal, discount, service_amount: service, tax_amount: tax, total: round2(base + service + tax) }, { transaction: t });
  return order;
}

// الطاولة مشغولة إذا لها طلب مفتوح، وفي حالة "فاتورة" إذا طُلبت الفاتورة، وإلا تعود فارغة
async function syncTableStatus(tableId, t) {
  if (!tableId) return;
  const open = await Order.findOne({ where: { table_id: tableId, status: { [Op.in]: ['open', 'billing'] } }, transaction: t });
  const table = await DiningTable.findByPk(tableId, { transaction: t });
  if (!table || table.status === 'reserved' && !open) return;
  const status = open ? (open.status === 'billing' ? 'billing' : 'occupied') : (table.status === 'cleaning' ? 'cleaning' : 'free');
  if (table.status !== status) await table.update({ status }, { transaction: t });
}

async function nextOrderNumber(restaurantId, t) {
  const max = await Order.max('number', { where: { restaurant_id: restaurantId }, transaction: t });
  return (max || 0) + 1;
}

// تحويل أصناف الطلب الواردة من العميل إلى أصناف محسوبة من المنيو (السعر دائمًا من قاعدة البيانات)
async function buildItems(restaurantId, rawItems, { status, source }, t) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw new HttpError(400, 'لا توجد أصناف في الطلب');
  if (rawItems.length > 50) throw new HttpError(400, 'عدد الأصناف كبير جدًا');
  const ids = [...new Set(rawItems.map((r) => r.menu_item_id))];
  const menuItems = await MenuItem.findAll({ where: { id: ids, restaurant_id: restaurantId, is_active: true }, include: [MenuCategory], transaction: t });
  const byId = Object.fromEntries(menuItems.map((m) => [m.id, m]));
  return rawItems.map((r) => {
    const m = byId[r.menu_item_id];
    if (!m) throw new HttpError(400, 'صنف غير موجود في المنيو');
    if (!m.is_available) throw new HttpError(400, `الصنف "${m.name_ar}" غير متوفر حاليًا`);
    const quantity = Math.floor(Number(r.quantity) || 1);
    if (quantity < 1 || quantity > 99) throw new HttpError(400, 'كمية غير صالحة');
    const chosen = (r.options || []).map((name) => {
      const opt = (m.options || []).find((o) => o.name === name);
      if (!opt) throw new HttpError(400, `خيار غير صالح للصنف "${m.name_ar}"`);
      return { name: opt.name, price: Number(opt.price || 0) };
    });
    return {
      menu_item_id: m.id,
      name: m.name_ar,
      unit_price: m.price,
      quantity,
      options: chosen,
      notes: r.notes ? String(r.notes).slice(0, 200) : null,
      station: m.MenuCategory?.station || 'kitchen',
      status,
      source,
    };
  });
}

// خصم المخزون حسب وصفة كل صنف مباع (عند الدفع فقط)
async function deductInventory(order, userId, t) {
  const items = await OrderItem.findAll({ where: { order_id: order.id, status: { [Op.ne]: 'cancelled' } }, transaction: t });
  const menuItems = await MenuItem.findAll({ where: { id: items.map((i) => i.menu_item_id).filter(Boolean) }, transaction: t });
  const recipeById = Object.fromEntries(menuItems.map((m) => [m.id, m.recipe || []]));
  const usage = {};
  for (const it of items) {
    for (const r of recipeById[it.menu_item_id] || []) {
      usage[r.inventory_item_id] = (usage[r.inventory_item_id] || 0) + Number(r.qty) * it.quantity;
    }
  }
  for (const [invId, qty] of Object.entries(usage)) {
    const inv = await InventoryItem.findOne({ where: { id: invId, restaurant_id: order.restaurant_id }, transaction: t });
    if (!inv) continue;
    await inv.update({ quantity: Number(inv.quantity) - qty }, { transaction: t });
    await StockMovement.create({ restaurant_id: order.restaurant_id, inventory_item_id: invId, kind: 'consumption', quantity: -qty, reference: `order #${order.number}`, user_id: userId }, { transaction: t });
  }
}

// إرجاع الطلب كاملًا مع الأصناف والطاولة
function loadOrder(id) {
  return Order.findByPk(id, {
    include: [
      { model: OrderItem, as: 'items' },
      { model: DiningTable, as: 'table' },
      { association: 'payments' },
      { association: 'captain', attributes: ['id', 'full_name'] },
    ],
    order: [[{ model: OrderItem, as: 'items' }, 'created_at', 'ASC']],
  });
}

module.exports = { HttpError, round2, recalcOrder, syncTableStatus, nextOrderNumber, buildItems, deductInventory, loadOrder };
