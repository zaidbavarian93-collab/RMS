const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class InventoryItem extends Model {}
InventoryItem.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    restaurant_id: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    unit: { type: DataTypes.STRING, allowNull: false, defaultValue: 'kg' },
    quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false, defaultValue: 0 },
    min_quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false, defaultValue: 0 },
    cost_per_unit: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    supplier: { type: DataTypes.STRING },
  },
  { sequelize, modelName: 'InventoryItem', tableName: 'inventory_items' }
);

class StockMovement extends Model {}
StockMovement.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    restaurant_id: { type: DataTypes.UUID, allowNull: false },
    inventory_item_id: { type: DataTypes.UUID, allowNull: false },
    kind: { type: DataTypes.STRING, allowNull: false }, // purchase | consumption | waste | adjustment
    quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false }, // موجب = إضافة، سالب = خصم
    reference: { type: DataTypes.STRING },
    user_id: { type: DataTypes.UUID },
  },
  { sequelize, modelName: 'StockMovement', tableName: 'stock_movements' }
);
module.exports = { InventoryItem, StockMovement };
