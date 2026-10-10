const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { User } = require('../models');
const { authenticate } = require('../middleware/auth');
const { logAudit } = require('../services/auditLog');

const router = express.Router();
const WEAK_PASSWORDS = ['admin123', '123456', '12345678', 'password', '123456789', 'captain123', 'cashier123', 'kitchen123', 'qwerty'];
const isWeakPassword = (p) => p.length < 8 || WEAK_PASSWORDS.includes(p.toLowerCase());

function publicUser(user, mustChange) {
  return { id: user.id, full_name: user.full_name, username: user.username, role: user.role, restaurant_id: user.restaurant_id, must_change_password: mustChange };
}
function signToken(user, mustChange) {
  const payload = { id: user.id, role: user.role, full_name: user.full_name, restaurant_id: user.restaurant_id };
  if (mustChange) payload.must_change_password = true;
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '12h' });
}

router.post('/login',
  [body('username').notEmpty().withMessage('اسم المستخدم مطلوب'), body('password').notEmpty().withMessage('كلمة المرور مطلوبة')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { username, password } = req.body;
    const user = await User.findOne({ where: { username } });
    if (!user || !user.is_active || !(await user.validatePassword(password))) {
      await logAudit({ req, action: 'login_failed', entityType: 'User', entityId: user?.id, userName: username, description: `محاولة دخول فاشلة: ${username}` });
      return res.status(401).json({ message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }
    await logAudit({ req, action: 'login_success', entityType: 'User', entityId: user.id, userId: user.id, userName: user.full_name, userRole: user.role, description: `تسجيل دخول: ${user.full_name}` });
    const mustChange = user.must_change_password || isWeakPassword(password);
    res.json({ token: signToken(user, mustChange), user: publicUser(user, mustChange) });
  }
);

router.post('/change-password', authenticate,
  [body('current_password').notEmpty(), body('new_password').isLength({ min: 8 }).withMessage('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
    const { current_password, new_password } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user || !(await user.validatePassword(current_password))) return res.status(400).json({ message: 'كلمة المرور الحالية غير صحيحة' });
    if (isWeakPassword(new_password)) return res.status(400).json({ message: 'كلمة المرور الجديدة ضعيفة جدًا، اختر كلمة أقوى' });
    if (new_password === current_password) return res.status(400).json({ message: 'كلمة المرور الجديدة يجب أن تختلف عن الحالية' });
    user.password_hash = new_password;
    user.must_change_password = false;
    await user.save();
    await logAudit({ req, action: 'update', entityType: 'User', entityId: user.id, description: `تغيير كلمة المرور: ${user.full_name}` });
    res.json({ ok: true, token: signToken(user, false) });
  }
);

router.get('/me', authenticate, async (req, res) => {
  const user = await User.findByPk(req.user.id, { attributes: ['id', 'full_name', 'username', 'role', 'restaurant_id'] });
  res.json(user);
});

module.exports = router;
