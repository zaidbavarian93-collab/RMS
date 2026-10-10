// اختبار تكامل شامل لدورة الطلب: يتطلب قاعدة بيانات مُعبّأة (npm run seed). التشغيل: npm test
require('dotenv').config();
const assert = require('assert');
const app = require('../index');

let base;
async function call(method, url, { token, body, key } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(key ? { 'Idempotency-Key': key } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}
// الحسابات التجريبية كلماتها ضعيفة فيُفرض تغييرها - نغيّرها كما يفعل المستخدم الحقيقي
async function login(username, password) {
  const r = await call('POST', '/api/auth/login', { body: { username, password } });
  assert.equal(r.status, 200, `login ${username}`);
  if (!r.data.user.must_change_password) return r.data.token;
  const c = await call('POST', '/api/auth/change-password', { token: r.data.token, body: { current_password: password, new_password: 'Str0ng!Pass-' + username } });
  assert.equal(c.status, 200, 'change password');
  return c.data.token;
}
const eq = (a, b, m) => assert.equal(Number(a), Number(b), m);

(async () => {
  const server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  try {
    const cap = await login('captain1', 'captain123');
    const cash = await login('cashier', 'cashier123');
    const kit = await login('kitchen', 'kitchen123');
    const mgr = await login('admin', 'admin123');

    // الصلاحيات
    assert.equal((await call('GET', '/api/orders', { token: kit })).status, 403, 'المطبخ لا يصل للطلبات');
    assert.equal((await call('GET', '/api/users', { token: cap })).status, 403, 'الكابتن لا يدير المستخدمين');
    assert.equal((await call('GET', '/api/orders')).status, 401, 'بلا توكن');

    const menu = (await call('GET', '/api/menu', { token: cap })).data;
    const find = (n) => menu.flatMap((c) => c.MenuItems).find((i) => i.name_ar === n);
    const kebab = find('كباب عراقي'), tea = find('شاي');
    const map = (await call('GET', '/api/tables/map', { token: cap })).data;
    const table = map.tables.find((t) => t.number === '1');
    assert.equal(table.status, 'free');

    // فتح طلب - كباب ×2 (12000 + خيار) + شاي ×2
    let r = await call('POST', '/api/orders', { token: cap, body: { type: 'dine_in', table_id: table.id, guests: 3, items: [
      { menu_item_id: kebab.id, quantity: 2, options: ['حار'] }, { menu_item_id: tea.id, quantity: 2 }] } });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    const order = r.data;
    eq(order.subtotal, 26000, 'subtotal'); eq(order.service_amount, 2600, 'service 10%'); eq(order.total, 28600, 'total');
    // السعر يأتي من الخادم دائمًا حتى لو أرسل العميل سعرًا مزيفًا
    r = await call('POST', `/api/orders/${order.id}/items`, { token: cap, body: { items: [{ menu_item_id: tea.id, quantity: 1, unit_price: 1 }] } });
    eq(r.data.subtotal, 27000, 'سعر مزيف يُتجاهل');
    // خيار غير موجود يُرفض
    assert.equal((await call('POST', `/api/orders/${order.id}/items`, { token: cap, body: { items: [{ menu_item_id: tea.id, options: ['x'] }] } })).status, 400);
    assert.equal((await call('GET', '/api/tables/map', { token: cap })).data.tables.find((t) => t.id === table.id).status, 'occupied');

    // فتح الطلب مجددًا لنفس الطاولة يعيد نفس الطلب (لا طلبات مكررة)
    r = await call('POST', '/api/orders', { token: cap, body: { type: 'dine_in', table_id: table.id } });
    assert.equal(r.data.id, order.id, 'نفس الطلب');

    // الفاتورة ممنوعة قبل إرسال المسودات
    assert.equal((await call('POST', `/api/orders/${order.id}/request-bill`, { token: cap })).status, 400);
    r = await call('POST', `/api/orders/${order.id}/send`, { token: cap });
    assert.equal(r.status, 200);
    assert.ok(r.data.items.every((i) => i.status === 'pending'));

    // المطبخ
    let k = (await call('GET', '/api/kitchen', { token: kit })).data;
    assert.equal(k.length, 3, 'المطبخ يرى 3 أصناف');
    assert.equal((await call('GET', '/api/kitchen?station=bar', { token: kit })).data.length, 2, 'فلتر المحطة');
    for (const it of k) { await call('POST', `/api/kitchen/items/${it.id}/advance`, { token: kit }); await call('POST', `/api/kitchen/items/${it.id}/advance`, { token: kit }); }
    assert.equal((await call('POST', `/api/kitchen/items/${k[0].id}/advance`, { token: kit })).status, 403, 'المطبخ لا يسلّم');
    assert.equal((await call('POST', `/api/kitchen/items/${k[0].id}/advance`, { token: cap })).status, 200, 'الكابتن يسلّم');

    // طلب الزبون من QR
    const t1 = (await call('GET', '/api/tables/map', { token: cap })).data.tables.find((t) => t.id === table.id);
    const pub = await call('GET', '/api/public/menu/nakheel?t=' + t1.qr_token);
    assert.equal(pub.status, 200); assert.equal(pub.data.table.number, '1');
    assert.ok(!JSON.stringify(pub.data).includes('recipe'), 'لا تسريب للوصفات');
    assert.equal((await call('POST', '/api/public/orders', { body: { table_token: 'bad', items: [] } })).status, 400);
    r = await call('POST', '/api/public/orders', { body: { table_token: t1.qr_token, items: [{ menu_item_id: tea.id, quantity: 3 }] } });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    assert.equal(r.data.order_number, order.number, 'يُضاف لنفس طلب الطاولة');
    let cur = (await call('GET', `/api/orders/${order.id}`, { token: cap })).data;
    const qrItem = cur.items.find((i) => i.status === 'awaiting_approval');
    assert.ok(qrItem); eq(cur.subtotal, 27000, 'صنف QR لا يُحسب قبل الموافقة');
    assert.equal((await call('POST', `/api/orders/${order.id}/request-bill`, { token: cap })).status, 400, 'ممنوع الفاتورة قبل البت');
    await call('POST', '/api/public/calls', { body: { table_token: t1.qr_token, kind: 'call_captain' } });
    assert.equal((await call('GET', '/api/calls', { token: cap })).data.length, 1);
    r = await call('POST', `/api/orders/${order.id}/items/${qrItem.id}/approve`, { token: cap });
    eq(r.data.subtotal, 30000, 'بعد الموافقة'); // 27000 + 3×1000
    // إلغاء صنف مُرسل: يحتاج سبب
    assert.equal((await call('POST', `/api/orders/${order.id}/items/${qrItem.id}/cancel`, { token: cap, body: {} })).status, 400);
    r = await call('POST', `/api/orders/${order.id}/items/${qrItem.id}/cancel`, { token: cap, body: { reason: 'الزبون غيّر رأيه' } });
    eq(r.data.subtotal, 27000, 'بعد الإلغاء');

    // الفاتورة والدفع
    assert.equal((await call('POST', `/api/orders/${order.id}/request-bill`, { token: cap })).status, 200);
    assert.equal((await call('POST', '/api/orders', { token: cap, body: { type: 'dine_in', table_id: table.id } })).status, 400, 'طاولة في مرحلة الفاتورة');
    assert.equal((await call('POST', `/api/orders/${order.id}/discount`, { token: cap, body: { discount: 1000 } })).status, 403, 'الكابتن لا يخصم');
    r = await call('POST', `/api/orders/${order.id}/discount`, { token: cash, body: { discount: 2000 } });
    eq(r.data.total, 27500, 'خصم 2000: (27000-2000)×1.1'); // base 25000 + service 2500
    assert.equal((await call('POST', `/api/orders/${order.id}/pay`, { token: cap, body: { method: 'cash', amount: 99999 } })).status, 403);
    assert.equal((await call('POST', `/api/orders/${order.id}/pay`, { token: cash, body: { payments: [{ method: 'cash', amount: 20000 }] } })).status, 400, 'دفع ناقص');
    r = await call('POST', `/api/orders/${order.id}/pay`, { token: cash, body: { payments: [{ method: 'cash', amount: 20000 }, { method: 'card', amount: 7500 }] } });
    assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.status, 'paid');
    assert.equal((await call('POST', `/api/orders/${order.id}/pay`, { token: cash, body: { method: 'cash', amount: 99999 } })).status, 400, 'لا دفع مزدوج');
    assert.equal((await call('GET', '/api/tables/map', { token: cap })).data.tables.find((t) => t.id === table.id).status, 'cleaning');
    assert.equal((await call('POST', `/api/tables/${table.id}/status`, { token: cap, body: { status: 'free' } })).status, 200);

    // المخزون: كباب ×2 → لحم 0.5 كغم + خبز 2 ، شاي ×3(2+1)
    const inv = (await call('GET', '/api/inventory', { token: mgr })).data;
    eq(inv.find((i) => i.name === 'لحم غنم').quantity, 39.5, 'خصم اللحم');
    eq(inv.find((i) => i.name === 'خبز صمون').quantity, 198, 'خصم الخبز');

    // التقارير
    const rep = (await call('GET', '/api/reports/summary', { token: mgr })).data;
    eq(rep.orders, 1); eq(rep.sales, 27500); eq(rep.discounts, 2000);
    assert.equal(rep.top_items[0].name, 'شاي'); eq(rep.top_items[0].quantity, 3);
    assert.equal(rep.by_method.length, 2);
    assert.equal((await call('GET', '/api/reports/summary', { token: cap })).status, 403);
    const live = (await call('GET', '/api/reports/live', { token: mgr })).data;
    eq(live.tables.total, 18);

    // منع التكرار: نفس الطلب المحفوظ أثناء انقطاع الاتصال يُرسل مرتين → يُنفَّذ مرة واحدة فقط
    const t2 = (await call('GET', '/api/tables/map', { token: cap })).data.tables.find((t) => t.number === '2');
    const offlineBody = { type: 'dine_in', table_id: t2.id, guests: 2, items: [{ menu_item_id: kebab.id, quantity: 1 }] };
    const first = await call('POST', '/api/orders', { token: cap, body: offlineBody, key: 'offline-test-0001' });
    const again = await call('POST', '/api/orders', { token: cap, body: offlineBody, key: 'offline-test-0001' });
    assert.equal(first.status, 201); assert.equal(again.status, 201);
    assert.equal(again.data.id, first.data.id, 'نفس الطلب');
    assert.equal(again.data.items.length, 1, 'الصنف لم يتكرر');
    const s1 = await call('POST', `/api/orders/${first.data.id}/send`, { token: cap, key: 'offline-test-0001.send' });
    const s2 = await call('POST', `/api/orders/${first.data.id}/send`, { token: cap, key: 'offline-test-0001.send' });
    assert.equal(s1.status, 200); assert.equal(s2.status, 200, 'إعادة الإرسال تعيد النتيجة المحفوظة');
    // نفس المفتاح من مستخدم آخر لا يتشارك النتيجة
    const other = await call('POST', '/api/orders', { token: cash, body: { ...offlineBody, items: [{ menu_item_id: tea.id }] }, key: 'offline-test-0001' });
    assert.equal(other.data.items.length, 2, 'مفتاح مستخدم آخر مستقل');
    assert.equal((await call('POST', '/api/orders', { token: cap, body: offlineBody, key: 'bad key!' })).status, 400);
    assert.equal((await call('GET', '/api/nope', { token: cap })).status, 404);

    // سجل التدقيق
    const logs = (await call('GET', '/api/audit-logs', { token: mgr })).data;
    assert.ok(logs.some((l) => /إلغاء/.test(l.description)) && logs.some((l) => /دفع طلب/.test(l.description)));

    console.log('✅ كل الاختبارات نجحت');
  } catch (e) {
    console.error('❌ فشل الاختبار:', e.message);
    process.exitCode = 1;
  } finally {
    server.close();
    require('../models').sequelize.close();
  }
})();
