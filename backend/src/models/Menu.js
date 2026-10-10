const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class MenuCategory extends Model {}
MenuCategory.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    restaurant_id: { type: DataTypes.UUID, allowNull: false },
    name_ar: { type: DataTypes.STRING, allowNull: false },
    name_en: { type: DataTypes.STRING },
    // المحطة التي تُحضّر فيها أصناف التصنيف (kitchen/bar/dessert/...) لتوجيه الطلب لشاشة المطبخ المناسبة
    station: { type: DataTypes.STRING, allowNull: false, defaultValue: 'kitchen' },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { sequelize, modelName: 'MenuCategory', tableName: 'menu_categories' }
);

class MenuItem extends Model {}
MenuItem.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    restaurant_id: { type: DataTypes.UUID, allowNull: false },
    category_id: { type: DataTypes.UUID, allowNull: false },
    name_ar: { type: DataTypes.STRING, allowNull: false },
    name_en: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    photo_path: { type: DataTypes.STRING },
    prep_minutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
    // إضافات/خيارات: [{ name: 'جبن إضافي', price: 1000 }]
    options: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    // الوصفة لخصم المخزون عند الدفع: [{ inventory_item_id, qty }]
    recipe: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    is_available: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }, // نفد مؤقتًا
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  { sequelize, modelName: 'MenuItem', tableName: 'menu_items' }
);
module.exports = { MenuCategory, MenuItem };
