package com.example.rms.data.model

import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant

// ===== نماذج البيانات (تطابق استجابات واجهة RMS الخلفية) =====

data class SessionUser(
    val id: String,
    val fullName: String,
    val username: String,
    val role: String,
    val mustChangePassword: Boolean,
    val restaurantId: String? = null
)

// هوية المطعم كما تُضبط من إعدادات النظام (الاسم والشعار)
data class Brand(val name: String?, val logoUrl: String?) {
    val displayName: String get() = name?.takeIf { it.isNotBlank() } ?: "نظام إدارة المطاعم"
}

data class Floor(val id: String, val name: String)

data class OrderOption(val name: String, val price: Double)

data class OrderItem(
    val id: String,
    val name: String,
    val quantity: Int,
    val unitPrice: Double,
    val options: List<OrderOption>,
    val notes: String?,
    val status: String,
    val source: String
) {
    val lineTotal: Double get() = (unitPrice + options.sumOf { it.price }) * quantity
}

data class Order(
    val id: String,
    val number: Int,
    val status: String, // open | billing | paid | cancelled
    val subtotal: Double,
    val discount: Double,
    val serviceAmount: Double,
    val taxAmount: Double,
    val total: Double,
    val guests: Int,
    val createdAt: String?,
    val items: List<OrderItem>
) {
    val isBilling get() = status == "billing"
    val liveItems get() = items.filter { it.status != "cancelled" }
}

data class TableCall(val id: String, val kind: String)

data class TableOrderSummary(
    val id: String,
    val number: Int,
    val status: String,
    val total: Double,
    val captainName: String?,
    val openedAt: String?,
    val pendingApproval: Int,
    val ready: Int
)

data class DiningTable(
    val id: String,
    val floorId: String,
    val number: String,
    val seats: Int,
    val status: String, // free | occupied | billing | reserved | cleaning
    val order: TableOrderSummary?,
    val calls: List<TableCall>
) {
    val needsAttention get() = calls.isNotEmpty() || (order?.ready ?: 0) > 0 || (order?.pendingApproval ?: 0) > 0
}

data class TableMap(val floors: List<Floor>, val tables: List<DiningTable>)

data class MenuItem(
    val id: String,
    val name: String,
    val price: Double,
    val isAvailable: Boolean,
    val options: List<OrderOption>
)

data class MenuCategory(val id: String, val name: String, val items: List<MenuItem>)

// سطر في سلة الكابتن قبل الإرسال للمطبخ
data class CartLine(
    val menuItemId: String,
    val name: String,
    val unitPrice: Double,
    val options: List<OrderOption>,
    val quantity: Int,
    val notes: String = ""
) {
    val key: String get() = menuItemId + "|" + options.joinToString(",") { it.name }
    val lineTotal: Double get() = (unitPrice + options.sumOf { it.price }) * quantity
}

// ===== التحويل من JSON =====

fun JSONObject.optNullableString(key: String): String? =
    if (isNull(key)) null else optString(key).takeIf { it.isNotEmpty() }

// الخادم يرجع الأعداد العشرية (DECIMAL) كنصوص مثل "4400.00"
fun JSONObject.optMoney(key: String): Double = if (isNull(key)) 0.0 else optString(key).toDoubleOrNull() ?: 0.0

inline fun <T> JSONArray?.mapObjects(transform: (JSONObject) -> T): List<T> {
    if (this == null) return emptyList()
    val out = ArrayList<T>(length())
    for (i in 0 until length()) optJSONObject(i)?.let { out.add(transform(it)) }
    return out
}

fun parseOptions(arr: JSONArray?): List<OrderOption> =
    arr.mapObjects { OrderOption(it.optString("name"), it.optMoney("price")) }

fun parseUser(json: JSONObject) = SessionUser(
    id = json.getString("id"),
    fullName = json.optString("full_name"),
    username = json.optString("username"),
    role = json.optString("role"),
    mustChangePassword = json.optBoolean("must_change_password", false),
    restaurantId = json.optNullableString("restaurant_id")
)

fun parseOrderItem(j: JSONObject) = OrderItem(
    id = j.getString("id"),
    name = j.optString("name"),
    quantity = j.optInt("quantity", 1),
    unitPrice = j.optMoney("unit_price"),
    options = parseOptions(j.optJSONArray("options")),
    notes = j.optNullableString("notes"),
    status = j.optString("status"),
    source = j.optString("source")
)

fun parseOrder(j: JSONObject) = Order(
    id = j.getString("id"),
    number = j.optInt("number"),
    status = j.optString("status"),
    subtotal = j.optMoney("subtotal"),
    discount = j.optMoney("discount"),
    serviceAmount = j.optMoney("service_amount"),
    taxAmount = j.optMoney("tax_amount"),
    total = j.optMoney("total"),
    guests = j.optInt("guests", 1),
    createdAt = j.optNullableString("createdAt"),
    items = j.optJSONArray("items").mapObjects(::parseOrderItem)
)

fun parseTableMap(j: JSONObject): TableMap = TableMap(
    floors = j.optJSONArray("floors").mapObjects { Floor(it.getString("id"), it.optString("name")) },
    tables = j.optJSONArray("tables").mapObjects { t ->
        DiningTable(
            id = t.getString("id"),
            floorId = t.optString("floor_id"),
            number = t.optString("number"),
            seats = t.optInt("seats", 4),
            status = t.optString("status"),
            order = t.optJSONObject("order")?.let { o ->
                TableOrderSummary(
                    id = o.getString("id"),
                    number = o.optInt("number"),
                    status = o.optString("status"),
                    total = o.optMoney("total"),
                    captainName = o.optJSONObject("captain")?.optNullableString("full_name"),
                    openedAt = o.optNullableString("opened_at"),
                    pendingApproval = o.optInt("pending_approval"),
                    ready = o.optInt("ready")
                )
            },
            calls = t.optJSONArray("calls").mapObjects { TableCall(it.getString("id"), it.optString("kind")) }
        )
    }
)

fun parseMenu(arr: JSONArray): List<MenuCategory> =
    arr.mapObjects { c ->
        MenuCategory(
            id = c.getString("id"),
            name = c.optString("name_ar"),
            items = c.optJSONArray("MenuItems").mapObjects { i ->
                MenuItem(
                    id = i.getString("id"),
                    name = i.optString("name_ar"),
                    price = i.optMoney("price"),
                    isAvailable = i.optBoolean("is_available", true),
                    options = parseOptions(i.optJSONArray("options"))
                ).takeIf { i.optBoolean("is_active", true) }
            }.filterNotNull()
        ).takeIf { c.optBoolean("is_active", true) }
    }.filterNotNull().filter { it.items.isNotEmpty() }

// عدد الدقائق منذ وقت ISO-8601 (مثل 2026-10-10T19:05:00.000Z)
fun minutesSince(iso: String?, now: Instant = Instant.now()): Int? =
    iso?.let { runCatching { ((now.epochSecond - Instant.parse(it).epochSecond) / 60).toInt().coerceAtLeast(0) }.getOrNull() }
