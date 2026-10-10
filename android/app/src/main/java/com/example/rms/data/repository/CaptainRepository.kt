package com.example.rms.data.repository

import com.example.rms.data.model.*
import com.example.rms.data.remote.ApiClient
import com.example.rms.data.remote.SessionStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONArray
import org.json.JSONObject

// الأدوار المسموح لها باستخدام تطبيق الكابتن (تطابق authorize() لمسارات الطلبات في الخادم)
val FLOOR_ROLES = setOf("owner", "manager", "cashier", "captain")

class CaptainRepository(private val api: ApiClient, private val session: SessionStore) {

    private val _user = MutableStateFlow(session.user.takeIf { session.token != null })
    val user: StateFlow<SessionUser?> = _user.asStateFlow()

    var baseUrl: String
        get() = session.baseUrl
        set(value) { session.baseUrl = value }

    // ===== الجلسة =====

    suspend fun login(serverUrl: String, username: String, password: String): SessionUser {
        session.baseUrl = serverUrl
        val res = api.post("/auth/login", JSONObject().put("username", username).put("password", password))
        val u = parseUser(res.getJSONObject("user"))
        session.token = res.getString("token")
        session.user = u
        _user.value = u
        return u
    }

    suspend fun changePassword(current: String, new: String) {
        val res = api.post("/auth/change-password", JSONObject().put("current_password", current).put("new_password", new))
        session.token = res.getString("token") // الرمز القديم يحمل علامة "يجب تغيير كلمة المرور"
        val updated = _user.value?.copy(mustChangePassword = false)
        session.user = updated
        _user.value = updated
    }

    fun logout() {
        session.clear()
        _user.value = null
    }

    // ===== الطاولات =====

    suspend fun tableMap(): TableMap = parseTableMap(api.getObject("/tables/map"))

    suspend fun setTableStatus(tableId: String, status: String) {
        api.post("/tables/$tableId/status", JSONObject().put("status", status))
    }

    suspend fun resolveCall(callId: String) {
        api.post("/calls/$callId/resolve")
    }

    // ===== المنيو =====

    suspend fun menu(): List<MenuCategory> = parseMenu(api.getArray("/menu"))

    // ===== الطلبات =====

    suspend fun orderForTable(tableId: String): Order? =
        api.getArray("/orders", mapOf("table_id" to tableId, "status" to "open,billing"))
            .optJSONObject(0)?.let(::parseOrder)

    // يفتح طلبًا للطاولة (أو يضيف على الطلب المفتوح) ثم يرسل الأصناف الجديدة للمطبخ
    suspend fun sendToKitchen(tableId: String, guests: Int, cart: List<CartLine>): Order {
        val items = JSONArray()
        cart.forEach { c ->
            items.put(
                JSONObject()
                    .put("menu_item_id", c.menuItemId)
                    .put("quantity", c.quantity)
                    .put("options", JSONArray(c.options.map { it.name }))
                    .put("notes", c.notes)
            )
        }
        val created = api.post(
            "/orders",
            JSONObject().put("type", "dine_in").put("table_id", tableId).put("guests", guests).put("items", items)
        )
        return parseOrder(api.post("/orders/${created.getString("id")}/send"))
    }

    suspend fun approveItem(orderId: String, itemId: String): Order =
        parseOrder(api.post("/orders/$orderId/items/$itemId/approve"))

    suspend fun cancelItem(orderId: String, itemId: String, reason: String): Order =
        parseOrder(api.post("/orders/$orderId/items/$itemId/cancel", JSONObject().put("reason", reason)))

    // تأكيد تقديم صنف جاهز للزبون (ready → served)
    suspend fun serveItem(itemId: String) {
        api.post("/kitchen/items/$itemId/advance")
    }

    suspend fun requestBill(orderId: String): Order = parseOrder(api.post("/orders/$orderId/request-bill"))

    suspend fun reopen(orderId: String): Order = parseOrder(api.post("/orders/$orderId/reopen"))

    suspend fun transfer(orderId: String, tableId: String): Order =
        parseOrder(api.post("/orders/$orderId/transfer", JSONObject().put("table_id", tableId)))
}
