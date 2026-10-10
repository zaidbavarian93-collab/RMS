const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// القاعة/المنطقة (صالة رئيسية، عائلات، تراس...) = "الصف" في SMS و"القسم" في HIS
class Floor extends Model {}
Floor.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    restaurant_id: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  { sequelize, modelName: 'Floor', tableName: 'floors' }
);

const TABLE_STATUSES = ['free', 'occupied', 'billing', 'reserved', 'cleaning'];

// الطاولة = "الشعبة" في SMS و"السرير" في HIS
class DiningTable extends Model {}
DiningTable.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    restaurant_id: { type: DataTypes.UUID, allowNull: false },
    floor_id: { type: DataTypes.UUID, allowNull: false },
    number: { type: DataTypes.STRING, allowNull: false },
    seats: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 4 },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'free' },
    // رمز فريد يُطبع في QR على الطاولة ويربط المنيو العام بها
    qr_token: { type: DataTypes.STRING, allowNull: false, unique: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { sequelize, modelName: 'DiningTable', tableName: 'dining_tables' }
);
module.exports = { Floor, DiningTable, TABLE_STATUSES };
