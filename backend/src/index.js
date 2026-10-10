require('dotenv').config();
const express = require('express');
// يجعل أي خطأ غير متوقع في مسارات async يصل إلى معالج الأخطاء العام بدل أن يُسقط العملية
require('express-async-errors');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { purgeOldKeys } = require('./middleware/idempotency');
const { sequelize } = require('./models');

const app = express();
// خلف Caddy/Nginx: نثق بعنوان العميل في X-Forwarded-For القادم من الشبكة المحلية فقط،
// حتى يعمل تحديد المعدل في المسارات العامة لكل زبون على حدة بدل اعتبار الجميع عنوانًا واحدًا
app.set('trust proxy', process.env.TRUST_PROXY || 'loopback, linklocal, uniquelocal');
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/restaurants', require('./routes/restaurants'));
app.use('/api/users', require('./routes/users'));
app.use('/api/tables', require('./routes/tables'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/kitchen', require('./routes/kitchen'));
app.use('/api/calls', require('./routes/calls'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/audit-logs', require('./routes/auditLogs'));
app.use('/api/public', require('./routes/public')); // بلا مصادقة: منيو QR للزبائن

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api', (req, res) => res.status(404).json({ message: 'المسار غير موجود' }));

// وضع "الخادم الواحد": إن وُجدت نسخة الواجهة المبنية (frontend/dist) يقدّمها الخادم نفسه،
// فيعمل النظام كموقع على دومين، أو كخادم محلي في المطعم بلا إنترنت (الأجهزة تفتح http://IP-الجهاز:4000)
const DIST = process.env.FRONTEND_DIST || path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(path.join(DIST, 'index.html'))) {
  app.use(express.static(DIST, {
    index: false,
    setHeaders: (res, file) => {
      // عامل الخدمة والـ manifest يجب ألا يُخزَّنا حتى تصل التحديثات فورًا؛ الملفات ذات البصمة تُخزَّن طويلًا
      if (/(sw\.js|manifest\.webmanifest|index\.html)$/.test(file)) res.setHeader('Cache-Control', 'no-cache');
      else if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  }));
  app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(DIST, 'index.html'));
  });
  console.log(`🌐 يقدّم الواجهة من ${DIST}`);
}

app.use((err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ message: err.message });
  if (err.name === 'MulterError') return res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'حجم الصورة أكبر من المسموح' : 'ملف غير صالح' });
  console.error(err);
  if (err.name === 'SequelizeForeignKeyConstraintError') return res.status(400).json({ message: 'مرجع غير صالح' });
  if (err.name === 'SequelizeUniqueConstraintError') return res.status(400).json({ message: 'قيمة مكررة' });
  if (err.name === 'SequelizeDatabaseError' && /invalid input syntax for type uuid/.test(err.message)) return res.status(400).json({ message: 'معرّف غير صالح' });
  res.status(500).json({ message: 'حدث خطأ في الخادم' });
});

process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));

const PORT = process.env.PORT || 4000;
// sync() لا يضيف أعمدة جديدة لجداول قائمة، فنضيفها هنا لقواعد البيانات المنشأة سابقًا
async function migrate() {
  await sequelize.query('ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS logo_path VARCHAR(255)');
}

if (require.main === module) {
  sequelize.sync()
    .then(migrate)
    .then(() => {
      purgeOldKeys().catch(() => {});
      setInterval(() => purgeOldKeys().catch(() => {}), 6 * 3600 * 1000).unref();
      app.listen(PORT, () => console.log(`✅ RMS running on port ${PORT}`));
    })
    .catch((err) => {
      console.error('❌ فشل الاتصال بقاعدة البيانات:', err.message);
      process.exit(1);
    });
}

module.exports = app;
