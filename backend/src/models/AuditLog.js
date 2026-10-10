const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class AuditLog extends Model {}
AuditLog.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    restaurant_id: { type: DataTypes.UUID },
    action: { type: DataTypes.STRING, allowNull: false },
    entity_type: { type: DataTypes.STRING },
    entity_id: { type: DataTypes.STRING },
    user_id: { type: DataTypes.UUID },
    user_name: { type: DataTypes.STRING },
    user_role: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    ip_address: { type: DataTypes.STRING },
  },
  { sequelize, modelName: 'AuditLog', tableName: 'audit_logs' }
);
module.exports = AuditLog;
