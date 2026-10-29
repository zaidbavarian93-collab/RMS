const { Op } = require('sequelize');
const { IdempotencyKey } = require('../models');

// يُفعَّل عند وجود ترويسة Idempotency-Key في طلب POST:
// - أول مرة: يُنفَّذ الطلب وتُحفظ النتيجة (عدا أخطاء 5xx حتى تُعاد المحاولة)
// - تكرار بنفس المفتاح: تُعاد النتيجة المحفوظة دون تنفيذ جديد
// - تكرار أثناء التنفيذ الأول: 409
async function idempotency(req, res, next) {
  const clientKey = req.get('Idempotency-Key');
  if (req.method !== 'POST' || !clientKey) return next();
  if (!/^[\w:.-]{8,120}$/.test(clientKey)) return res.status(400).json({ message: 'مفتاح منع التكرار غير صالح' });

  const key = `${req.user.id}:${req.method}:${req.originalUrl.split('?')[0]}:${clientKey}`;
  const existing = await IdempotencyKey.findByPk(key);
  if (existing) {
    if (existing.status_code == null) return res.status(409).json({ message: 'الطلب قيد المعالجة' });
    res.set('Idempotent-Replay', 'true');
    return res.status(existing.status_code).json(existing.body);
  }
  try {
    await IdempotencyKey.create({ key, user_id: req.user.id });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ message: 'الطلب قيد المعالجة' });
    throw err;
  }

  const json = res.json.bind(res);
  res.json = (body) => {
    const code = res.statusCode;
    const done = code >= 500
      ? IdempotencyKey.destroy({ where: { key } })
      : IdempotencyKey.update({ status_code: code, body }, { where: { key } });
    done.catch((e) => console.error('idempotency:', e.message));
    return json(body);
  };
  // إن انقطع الاتصال قبل أي رد نحرر المفتاح لتُعاد المحاولة
  res.on('close', () => {
    if (!res.writableEnded) IdempotencyKey.destroy({ where: { key, status_code: null } }).catch(() => {});
  });
  next();
}

// حذف المفاتيح الأقدم من 7 أيام
function purgeOldKeys() {
  return IdempotencyKey.destroy({ where: { created_at: { [Op.lt]: new Date(Date.now() - 7 * 86400000) } } });
}

module.exports = { idempotency, purgeOldKeys };
