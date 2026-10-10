import com.example.rms.data.model.*
import com.example.rms.data.remote.*
import com.example.rms.data.repository.CaptainRepository
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject

// اختبار طبقة بيانات تطبيق الكابتن (نفس الكود المستخدم في الأندرويد) مقابل خادم RMS الحقيقي
val BASE: String = System.getenv("RMS_URL") ?: "http://127.0.0.1:4000"

fun main() = runBlocking {
    val store = MemorySessionStore(BASE)
    val api = ApiClient(store)
    val repo = CaptainRepository(api, store)

    // خطأ دخول واضح
    val bad = runCatching { repo.login(BASE, "captain1", "wrong") }.exceptionOrNull() as ApiException
    check(bad.status == 401) { "bad login ${bad.status}" }

    val u = repo.login(BASE, "captain1", "captain123")
    check(u.role == "captain" && u.mustChangePassword) { "must change pw: $u" }
    val blocked = runCatching { repo.tableMap() }.exceptionOrNull() as ApiException
    check(blocked.mustChangePassword) { "server must block before change" }
    repo.changePassword("captain123", "Str0ng!Captain")
    check(repo.user.value?.mustChangePassword == false)

    val map = repo.tableMap()
    check(map.floors.size == 3 && map.tables.size == 18) { "map ${map.floors.size}/${map.tables.size}" }
    val t = map.tables.first { it.number == "5" }
    check(t.status == "free" && t.order == null)

    val menu = repo.menu()
    check(menu.size == 5) { "menu ${menu.size}" }
    val all = menu.flatMap { it.items }
    val kebab = all.first { it.name == "كباب عراقي" }
    val tea = all.first { it.name == "شاي" }
    check(kebab.options.map { it.name } == listOf("بدون بصل", "حار")) { "options ${kebab.options}" }

    val order = repo.sendToKitchen(t.id, 2, listOf(
        CartLine(kebab.id, kebab.name, kebab.price, listOf(kebab.options[1]), 2, "بدون ثوم"),
        CartLine(tea.id, tea.name, tea.price, emptyList(), 1)
    ))
    check(order.items.size == 2 && order.items.all { it.status == "pending" }) { "sent ${order.items.map { it.status }}" }
    check(order.subtotal == 25000.0 && order.serviceAmount == 2500.0 && order.total == 27500.0) { "totals ${order.total}" }
    check(order.items.first { it.name == "كباب عراقي" }.notes == "بدون ثوم")
    check(minutesSince(order.createdAt) == 0) { "minutesSince ${order.createdAt}" }

    // طلب الزبون من QR ثم موافقة الكابتن
    val tokenRow = api.getObject("/tables/map").getJSONArray("tables").let { arr -> (0 until arr.length()).map { arr.getJSONObject(it) }.first { it.getString("id") == t.id } }
    val conn = java.net.URL("$BASE/api/public/orders").openConnection() as java.net.HttpURLConnection
    conn.requestMethod = "POST"; conn.doOutput = true; conn.setRequestProperty("Content-Type", "application/json")
    conn.outputStream.write(JSONObject().put("table_token", tokenRow.getString("qr_token")).put("items", JSONArray().put(JSONObject().put("menu_item_id", tea.id).put("quantity", 2))).toString().toByteArray())
    check(conn.responseCode == 201) { "qr order ${conn.responseCode}" }
    val call = java.net.URL("$BASE/api/public/calls").openConnection() as java.net.HttpURLConnection
    call.requestMethod = "POST"; call.doOutput = true; call.setRequestProperty("Content-Type", "application/json")
    call.outputStream.write(JSONObject().put("table_token", tokenRow.getString("qr_token")).put("kind", "call_captain").toString().toByteArray()); check(call.responseCode == 201)

    val m2 = repo.tableMap().tables.first { it.id == t.id }
    check(m2.status == "occupied" && m2.order!!.pendingApproval == 1 && m2.calls.size == 1 && m2.needsAttention) { "attention $m2" }
    val cur = repo.orderForTable(t.id)!!
    val qrItem = cur.items.first { it.status == "awaiting_approval" }
    check(qrItem.source == "qr" && cur.subtotal == 25000.0) { "qr not billed before approval" }
    val approved = repo.approveItem(cur.id, qrItem.id)
    check(approved.subtotal == 27000.0) { "after approve ${approved.subtotal}" }
    repo.resolveCall(m2.calls[0].id)
    check(repo.tableMap().tables.first { it.id == t.id }.calls.isEmpty())

    // إلغاء بدون سبب مرفوض، وبسبب ينجح
    val noReason = runCatching { repo.cancelItem(cur.id, qrItem.id, "") }.exceptionOrNull() as ApiException
    check(noReason.status == 400) { "cancel w/o reason ${noReason.status}" }
    val cancelled = repo.cancelItem(cur.id, qrItem.id, "غيّر رأيه")
    check(cancelled.subtotal == 25000.0)

    // الفاتورة ثم إعادة الفتح ثم النقل
    check(repo.requestBill(cur.id).isBilling)
    check(!repo.reopen(cur.id).isBilling)
    val target = repo.tableMap().tables.first { it.number == "6" }
    repo.transfer(cur.id, target.id)
    val after = repo.tableMap().tables
    check(after.first { it.id == t.id }.status == "free" && after.first { it.id == target.id }.status == "occupied") { "transfer" }
    check(repo.orderForTable(t.id) == null && repo.orderForTable(target.id)!!.id == cur.id)

    // انتهاء الجلسة
    repo.logout(); check(repo.user.value == null && store.token == null)
    println("OK - Android data-layer test passed")
}
