const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// مفاتيح منع التكرار: الطلبات المحفوظة أثناء انقطاع الاتصال تُعاد إرسالها، فنحفظ نتيجة أول تنفيذ ونعيدها
// بدل تنفيذ العملية مرتين (مثلًا عند ضياع الرد بعد نجاح إنشاء الطلب)
class IdempotencyKey extends Model {}
IdempotencyKey.init(
  {
    key: { type: DataTypes.STRING(300), primaryKey: true }, // user_id:method:path:client_key
    user_id: { type: DataTypes.UUID, allowNull: false },
    status_code: { type: DataTypes.INTEGER }, // فارغ = قيد التنفيذ
    body: { type: DataTypes.JSONB },
  },
  { sequelize, modelName: 'IdempotencyKey', tableName: 'idempotency_keys' }
);
module.exports = IdempotencyKey;
