const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// المطعم/الفرع - المستوى الأعلى في الهرم (مثل المدرسة في SMS والمستشفى في HIS)
class Restaurant extends Model {}
Restaurant.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    slug: { type: DataTypes.STRING, allowNull: false, unique: true }, // يُستخدم في رابط المنيو العام /m/:slug
    // الهوية: الاسم أعلاه + الشعار (يظهر في الواجهة وشاشة الدخول والمنيو العام والفاتورة وبطاقات QR)
    logo_path: { type: DataTypes.STRING },
    phone: { type: DataTypes.STRING },
    address: { type: DataTypes.STRING },
    currency: { type: DataTypes.STRING, allowNull: false, defaultValue: 'IQD' },
    tax_percent: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    service_percent: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    // السماح للزبون بالطلب من المنيو عبر QR (تظهر الطلبات للكابتن للموافقة)
    qr_ordering_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { sequelize, modelName: 'Restaurant', tableName: 'restaurants' }
);
module.exports = Restaurant;
