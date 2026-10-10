const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'يجب تسجيل الدخول أولاً' });
  }
  try {
    req.user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET); // { id, role, full_name, restaurant_id }
  } catch (err) {
    return res.status(401).json({ message: 'جلسة الدخول غير صالحة أو منتهية' });
  }
  // يُفرض على الخادم وليس في الواجهة فقط، حتى لا يتجاوزه أي عميل آخر (مثل تطبيق الجوال)
  if (req.user.must_change_password && req.originalUrl.split('?')[0] !== '/api/auth/change-password') {
    return res.status(403).json({ code: 'must_change_password', message: 'يجب تغيير كلمة المرور قبل المتابعة' });
  }
  next();
}

// authorize('manager', 'cashier')
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'لا تملك صلاحية للقيام بهذا الإجراء' });
    }
    next();
  };
}

// المالك يرى كل الفروع (يمرّر restaurant_id)، وغيره مقيّد بفرعه فقط
function scopeRestaurant(req) {
  return req.user.role === 'owner' ? (req.query.restaurant_id || req.body?.restaurant_id || req.user.restaurant_id) : req.user.restaurant_id;
}

module.exports = { authenticate, authorize, scopeRestaurant };
