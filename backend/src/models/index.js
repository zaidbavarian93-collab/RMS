const sequelize = require('../config/db');
const Restaurant = require('./Restaurant');
const { User, ROLES } = require('./User');
const { Floor, DiningTable, TABLE_STATUSES } = require('./Floor');
const { MenuCategory, MenuItem } = require('./Menu');
const { Order, OrderItem, Payment, TableCall, ORDER_TYPES, ORDER_STATUSES, ITEM_STATUSES, PAYMENT_METHODS } = require('./Order');
const { InventoryItem, StockMovement } = require('./Inventory');
const AuditLog = require('./AuditLog');

Restaurant.hasMany(User, { foreignKey: 'restaurant_id' });
Restaurant.hasMany(Floor, { foreignKey: 'restaurant_id' });
Restaurant.hasMany(DiningTable, { foreignKey: 'restaurant_id' });
Restaurant.hasMany(MenuCategory, { foreignKey: 'restaurant_id' });
Restaurant.hasMany(Order, { foreignKey: 'restaurant_id' });

Floor.hasMany(DiningTable, { foreignKey: 'floor_id' });
DiningTable.belongsTo(Floor, { foreignKey: 'floor_id' });

MenuCategory.hasMany(MenuItem, { foreignKey: 'category_id' });
MenuItem.belongsTo(MenuCategory, { foreignKey: 'category_id' });

Order.belongsTo(DiningTable, { as: 'table', foreignKey: 'table_id' });
DiningTable.hasMany(Order, { foreignKey: 'table_id' });
Order.belongsTo(User, { as: 'captain', foreignKey: 'captain_id' });
Order.hasMany(OrderItem, { as: 'items', foreignKey: 'order_id' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id' });
Order.hasMany(Payment, { as: 'payments', foreignKey: 'order_id' });
Payment.belongsTo(Order, { foreignKey: 'order_id' });

TableCall.belongsTo(DiningTable, { as: 'table', foreignKey: 'table_id' });
StockMovement.belongsTo(InventoryItem, { foreignKey: 'inventory_item_id' });

module.exports = {
  sequelize, Restaurant, User, ROLES, Floor, DiningTable, TABLE_STATUSES, MenuCategory, MenuItem,
  Order, OrderItem, Payment, TableCall, ORDER_TYPES, ORDER_STATUSES, ITEM_STATUSES, PAYMENT_METHODS,
  InventoryItem, StockMovement, AuditLog,
};
