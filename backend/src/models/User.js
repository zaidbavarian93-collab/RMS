const { DataTypes, Model } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/db');

const ROLES = [
  'owner',    // مالك/إدارة عامة - يرى كل الفروع (مثل ministry_admin)
  'manager',  // مدير الفرع
  'cashier',  // كاشير - الفواتير والدفع
  'captain',  // كابتن الصالة - الطاولات والطلبات
  'kitchen',  // المطبخ - شاشة الطلبات
];

class User extends Model {
  async validatePassword(plain) {
    return bcrypt.compare(plain, this.password_hash);
  }
}
User.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    restaurant_id: { type: DataTypes.UUID, allowNull: true }, // فارغ للمالك
    full_name: { type: DataTypes.STRING, allowNull: false },
    username: { type: DataTypes.STRING, allowNull: false, unique: true },
    password_hash: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING },
    base_salary: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    must_change_password: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    hooks: {
      beforeCreate: async (u) => { if (u.password_hash) u.password_hash = await bcrypt.hash(u.password_hash, 10); },
      beforeUpdate: async (u) => { if (u.changed('password_hash')) u.password_hash = await bcrypt.hash(u.password_hash, 10); },
    },
  }
);
module.exports = { User, ROLES };
