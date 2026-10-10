require('dotenv').config();
const express = require('express');
// يجعل أي خطأ غير متوقع في مسارات async يصل إلى معالج الأخطاء العام بدل أن يُسقط العملية
require('express-async-errors');
const cors = require('cors');
const path = require('path');
const { sequelize } = require('./models');

const app = express();
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

app.use((err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ message: err.message });
  console.error(err);
  if (err.name === 'SequelizeForeignKeyConstraintError') return res.status(400).json({ message: 'مرجع غير صالح' });
  if (err.name === 'SequelizeUniqueConstraintError') return res.status(400).json({ message: 'قيمة مكررة' });
  if (err.name === 'SequelizeDatabaseError' && /invalid input syntax for type uuid/.test(err.message)) return res.status(400).json({ message: 'معرّف غير صالح' });
  res.status(500).json({ message: 'حدث خطأ في الخادم' });
});

process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  sequelize.sync()
    .then(() => app.listen(PORT, () => console.log(`✅ RMS backend running on port ${PORT}`)))
    .catch((err) => {
      console.error('❌ فشل الاتصال بقاعدة البيانات:', err.message);
      process.exit(1);
    });
}

module.exports = app;
