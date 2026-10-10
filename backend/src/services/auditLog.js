const { AuditLog } = require('../models');

async function logAudit({ req, action, entityType, entityId, userId, userName, userRole, description }) {
  try {
    await AuditLog.create({
      restaurant_id: req?.user?.restaurant_id || null,
      action,
      entity_type: entityType || null,
      entity_id: entityId || null,
      user_id: userId || req?.user?.id || null,
      user_name: userName || req?.user?.full_name || null,
      user_role: userRole || req?.user?.role || null,
      description: description || null,
      ip_address: req?.ip || null,
    });
  } catch (err) {
    console.error('فشل تسجيل سجل التدقيق:', err.message);
  }
}

module.exports = { logAudit };
