const express = require('express');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');
const { authenticate, authorize, scopeRestaurant } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('owner', 'manager', 'cashier'));

function range(req) {
  const to = req.query.to ? new Date(`${req.query.to}T23:59:59.999`) : new Date();
  const from = req.query.from ? new Date(`${req.query.from}T00:00:00`) : new Date(new Date().setHours(0, 0, 0, 0));
  return { from, to };
}

// ملخص المبيعات للفترة: إجمالي، عدد الطلبات، متوسط الفاتورة، حسب الدفع/النوع/الكابتن/الساعة + الأكثر مبيعًا
router.get('/summary', async (req, res) => {
  const rid = scopeRestaurant(req);
  const { from, to } = range(req);
  const rep = { rid, from, to };
  const q = (sql) => sequelize.query(sql, { replacements: rep, type: QueryTypes.SELECT });
  const base = `o.restaurant_id = :rid AND o.status = 'paid' AND o.paid_at BETWEEN :from AND :to`;

  const [totals] = await q(`SELECT COUNT(*)::int AS orders, COALESCE(SUM(total),0)::float AS sales, COALESCE(SUM(discount),0)::float AS discounts,
    COALESCE(SUM(service_amount),0)::float AS service, COALESCE(SUM(tax_amount),0)::float AS tax, COALESCE(SUM(guests),0)::int AS guests
    FROM orders o WHERE ${base}`);
  const byMethod = await q(`SELECT p.method, COALESCE(SUM(p.amount),0)::float AS amount FROM payments p JOIN orders o ON o.id = p.order_id WHERE ${base} GROUP BY p.method`);
  const byType = await q(`SELECT o.type, COUNT(*)::int AS orders, COALESCE(SUM(o.total),0)::float AS sales FROM orders o WHERE ${base} GROUP BY o.type`);
  const byCaptain = await q(`SELECT u.full_name AS captain, COUNT(*)::int AS orders, COALESCE(SUM(o.total),0)::float AS sales FROM orders o LEFT JOIN users u ON u.id = o.captain_id WHERE ${base} GROUP BY u.full_name ORDER BY sales DESC`);
  const byHour = await q(`SELECT EXTRACT(HOUR FROM o.paid_at)::int AS hour, COUNT(*)::int AS orders, COALESCE(SUM(o.total),0)::float AS sales FROM orders o WHERE ${base} GROUP BY 1 ORDER BY 1`);
  const topItems = await q(`SELECT i.name, SUM(i.quantity)::int AS quantity, COALESCE(SUM(i.quantity * i.unit_price),0)::float AS sales
    FROM order_items i JOIN orders o ON o.id = i.order_id WHERE ${base} AND i.status <> 'cancelled' GROUP BY i.name ORDER BY quantity DESC LIMIT 10`);
  const [cancelled] = await q(`SELECT COUNT(*)::int AS items FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.restaurant_id = :rid AND i.status = 'cancelled' AND i.updated_at BETWEEN :from AND :to`);

  res.json({
    from, to, ...totals,
    avg_ticket: totals.orders ? Math.round((totals.sales / totals.orders) * 100) / 100 : 0,
    cancelled_items: cancelled.items,
    by_method: byMethod, by_type: byType, by_captain: byCaptain, by_hour: byHour, top_items: topItems,
  });
});

// لقطة حيّة للوحة التحكم: طاولات مشغولة، طلبات مفتوحة، أصناف في المطبخ، مواد تحت الحد الأدنى
router.get('/live', async (req, res) => {
  const rid = scopeRestaurant(req);
  const q = (sql) => sequelize.query(sql, { replacements: { rid }, type: QueryTypes.SELECT });
  const [tables] = await q(`SELECT COUNT(*) FILTER (WHERE status <> 'free')::int AS busy, COUNT(*)::int AS total FROM dining_tables WHERE restaurant_id = :rid AND is_active`);
  const [open] = await q(`SELECT COUNT(*)::int AS open_orders, COALESCE(SUM(total),0)::float AS open_value FROM orders WHERE restaurant_id = :rid AND status IN ('open','billing')`);
  const [kitchen] = await q(`SELECT COUNT(*) FILTER (WHERE i.status = 'pending')::int AS pending, COUNT(*) FILTER (WHERE i.status = 'preparing')::int AS preparing, COUNT(*) FILTER (WHERE i.status = 'ready')::int AS ready,
    COUNT(*) FILTER (WHERE i.status = 'awaiting_approval')::int AS awaiting_approval
    FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.restaurant_id = :rid AND o.status IN ('open','billing')`);
  const lowStock = await q(`SELECT id, name, unit, quantity::float, min_quantity::float FROM inventory_items WHERE restaurant_id = :rid AND quantity <= min_quantity ORDER BY name`);
  res.json({ tables, ...open, kitchen, low_stock: lowStock });
});

module.exports = router;
