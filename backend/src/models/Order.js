const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

const ORDER_TYPES = ['dine_in', 'takeaway', 'delivery'];
// open: مفتوح (يُضاف إليه) | billing: طُلبت الفاتورة | paid: مدفوع | cancelled: ملغى
const ORDER_STATUSES = ['open', 'billing', 'paid', 'cancelled'];
// awaiting_approval: طلب زبون من QR بانتظار موافقة الكابتن | draft: لم يُرسل للمطبخ بعد
// pending → preparing → ready → served | cancelled
const ITEM_STATUSES = ['awaiting_approval', 'draft', 'pending', 'preparing', 'ready', 'served', 'cancelled'];

class Order extends Model {}
Order.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    restaurant_id: { type: DataTypes.UUID, allowNull: false },
    number: { type: DataTypes.INTEGER, allowNull: false }, // رقم تسلسلي لكل مطعم
    type: { type: DataTypes.STRING, allowNull: false, defaultValue: 'dine_in' },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'open' },
    table_id: { type: DataTypes.UUID },
    captain_id: { type: DataTypes.UUID },
    guests: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    customer_name: { type: DataTypes.STRING },
    customer_phone: { type: DataTypes.STRING },
    delivery_address: { type: DataTypes.STRING },
    notes: { type: DataTypes.TEXT },
    subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    discount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    service_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    tax_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    paid_at: { type: DataTypes.DATE },
    cashier_id: { type: DataTypes.UUID },
  },
  { sequelize, modelName: 'Order', tableName: 'orders', indexes: [{ unique: true, fields: ['restaurant_id', 'number'] }] }
);

class OrderItem extends Model {}
OrderItem.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    order_id: { type: DataTypes.UUID, allowNull: false },
    menu_item_id: { type: DataTypes.UUID },
    // لقطة (snapshot) من الاسم والسعر وقت الطلب حتى لا يتغير الطلب لو عُدّل المنيو لاحقًا
    name: { type: DataTypes.STRING, allowNull: false },
    unit_price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    options: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    notes: { type: DataTypes.STRING },
    station: { type: DataTypes.STRING, allowNull: false, defaultValue: 'kitchen' },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'draft' },
    source: { type: DataTypes.STRING, allowNull: false, defaultValue: 'captain' }, // captain | cashier | qr
    cancel_reason: { type: DataTypes.STRING },
    sent_at: { type: DataTypes.DATE },
    ready_at: { type: DataTypes.DATE },
  },
  { sequelize, modelName: 'OrderItem', tableName: 'order_items' }
);

const PAYMENT_METHODS = ['cash', 'card', 'online'];
class Payment extends Model {}
Payment.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    restaurant_id: { type: DataTypes.UUID, allowNull: false },
    order_id: { type: DataTypes.UUID, allowNull: false },
    method: { type: DataTypes.STRING, allowNull: false, defaultValue: 'cash' },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    cashier_id: { type: DataTypes.UUID },
  },
  { sequelize, modelName: 'Payment', tableName: 'payments' }
);

// نداء الزبون من QR: استدعاء الكابتن أو طلب الفاتورة
class TableCall extends Model {}
TableCall.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    restaurant_id: { type: DataTypes.UUID, allowNull: false },
    table_id: { type: DataTypes.UUID, allowNull: false },
    kind: { type: DataTypes.STRING, allowNull: false, defaultValue: 'call_captain' }, // call_captain | request_bill | water
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'open' }, // open | resolved
    resolved_by: { type: DataTypes.UUID },
    resolved_at: { type: DataTypes.DATE },
  },
  { sequelize, modelName: 'TableCall', tableName: 'table_calls' }
);
module.exports = { Order, OrderItem, Payment, TableCall, ORDER_TYPES, ORDER_STATUSES, ITEM_STATUSES, PAYMENT_METHODS };
