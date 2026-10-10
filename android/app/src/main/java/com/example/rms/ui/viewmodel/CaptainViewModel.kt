package com.example.rms.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.rms.data.model.Brand
import com.example.rms.data.model.CartLine
import com.example.rms.data.model.MenuCategory
import com.example.rms.data.model.MenuItem
import com.example.rms.data.model.Order
import com.example.rms.data.model.OrderItem
import com.example.rms.data.model.OrderOption
import com.example.rms.data.model.SessionUser
import com.example.rms.data.model.TableMap
import com.example.rms.data.remote.ApiException
import com.example.rms.data.repository.CaptainRepository
import com.example.rms.data.repository.FLOOR_ROLES
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class CaptainViewModel(private val repository: CaptainRepository) : ViewModel() {

    // ===== الجلسة =====
    val user: StateFlow<SessionUser?> = repository.user
    val defaultBaseUrl: String get() = repository.baseUrl
    val isAllowedRole: Boolean get() = user.value?.role in FLOOR_ROLES

    private val _authBusy = MutableStateFlow(false)
    val authBusy: StateFlow<Boolean> = _authBusy.asStateFlow()
    private val _authError = MutableStateFlow<String?>(null)
    val authError: StateFlow<String?> = _authError.asStateFlow()

    // ===== الحالة العامة =====
    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    // رسالة تُعرض مرة واحدة (Snackbar) ثم تُمسح
    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message.asStateFlow()

    // لا يوجد اتصال بالخادم (يُعرض شريط تنبيه ويستمر التحديث تلقائيًا)
    private val _offline = MutableStateFlow(false)
    val offline: StateFlow<Boolean> = _offline.asStateFlow()

    // ===== الطاولات والطلب =====
    private val _tableMap = MutableStateFlow<TableMap?>(null)
    val tableMap: StateFlow<TableMap?> = _tableMap.asStateFlow()

    private val _menu = MutableStateFlow<List<MenuCategory>>(emptyList())
    val menu: StateFlow<List<MenuCategory>> = _menu.asStateFlow()

    private val _selectedTableId = MutableStateFlow<String?>(null)
    val selectedTableId: StateFlow<String?> = _selectedTableId.asStateFlow()

    private val _order = MutableStateFlow<Order?>(null)
    val order: StateFlow<Order?> = _order.asStateFlow()

    // false حتى يصل أول رد لطلب الطاولة المفتوحة (لتمييز "لا يوجد طلب" عن "جارٍ التحميل")
    private val _orderLoaded = MutableStateFlow(false)
    val orderLoaded: StateFlow<Boolean> = _orderLoaded.asStateFlow()

    private val _cart = MutableStateFlow<List<CartLine>>(emptyList())
    val cart: StateFlow<List<CartLine>> = _cart.asStateFlow()

    private val _guests = MutableStateFlow(2)
    val guests: StateFlow<Int> = _guests.asStateFlow()

    fun consumeMessage() { _message.value = null }

    // ===== هوية المطعم (الاسم والشعار من إعدادات النظام) =====
    private val _brand = MutableStateFlow(repository.cachedBrand)
    val brand: StateFlow<Brand> = _brand.asStateFlow()
    private var ticksSinceBrand = 0

    fun refreshBrand() {
        viewModelScope.launch {
            try { _brand.value = repository.branding() } catch (_: ApiException) { /* نبقي آخر هوية محفوظة */ }
        }
    }

    init { refreshBrand() }

    // ===== الدخول =====

    fun login(serverUrl: String, username: String, password: String) {
        if (username.isBlank() || password.isBlank()) { _authError.value = "أدخل اسم المستخدم وكلمة المرور"; return }
        viewModelScope.launch {
            _authBusy.value = true
            _authError.value = null
            try {
                repository.login(serverUrl.trim().trimEnd('/'), username.trim(), password)
                refreshBrand()
            } catch (e: ApiException) {
                _authError.value = e.message
            } finally {
                _authBusy.value = false
            }
        }
    }

    fun changePassword(current: String, new: String, confirm: String) {
        when {
            new.length < 8 -> { _authError.value = "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل"; return }
            new != confirm -> { _authError.value = "كلمتا المرور غير متطابقتين"; return }
        }
        viewModelScope.launch {
            _authBusy.value = true
            _authError.value = null
            try {
                repository.changePassword(current, new)
                refreshBrand()
            } catch (e: ApiException) {
                _authError.value = e.message
            } finally {
                _authBusy.value = false
            }
        }
    }

    fun logout() {
        repository.logout()
        _tableMap.value = null
        _menu.value = emptyList()
        resetOrderState()
        _authError.value = null
    }

    // ===== التحديث الدوري =====

    // يُستدعى كل بضع ثوانٍ من النشاط طالما التطبيق ظاهر
    suspend fun tick() {
        val u = user.value ?: return
        if (u.mustChangePassword || !isAllowedRole) return
        try {
            _tableMap.value = repository.tableMap()
            // تحديث الهوية كل دقيقة تقريبًا حتى يظهر تغيير الاسم/الشعار من الإعدادات
            if (++ticksSinceBrand >= 12) { ticksSinceBrand = 0; refreshBrand() }
            if (_menu.value.isEmpty()) _menu.value = repository.menu()
            _selectedTableId.value?.let { loadOrder(it) }
            _offline.value = false
        } catch (e: ApiException) {
            handleError(e, silent = true)
        }
    }

    fun refreshNow() { viewModelScope.launch { tick() } }

    private suspend fun loadOrder(tableId: String) {
        val o = repository.orderForTable(tableId)
        // تجاهل رد متأخر إن كان الكابتن قد غادر هذه الطاولة أثناء الانتظار
        if (_selectedTableId.value == tableId) {
            _order.value = o
            _orderLoaded.value = true
        }
    }

    private fun handleError(e: ApiException, silent: Boolean = false) {
        when {
            e.isUnauthorized -> { logout(); _message.value = "انتهت الجلسة، سجّل الدخول من جديد" }
            e.status == 0 -> { _offline.value = true; if (!silent) _message.value = e.message }
            !silent -> _message.value = e.message
        }
    }

    // ينفّذ إجراءً على الخادم ثم يحدّث الحالة؛ يعرض رسالة النجاح أو الخطأ
    private fun act(successMessage: String? = null, block: suspend () -> Unit) {
        viewModelScope.launch {
            _loading.value = true
            try {
                block()
                successMessage?.let { _message.value = it }
                tick()
            } catch (e: ApiException) {
                handleError(e)
            } finally {
                _loading.value = false
            }
        }
    }

    // ===== اختيار الطاولة =====

    fun openTable(tableId: String) {
        resetOrderState()
        _selectedTableId.value = tableId
        val seats = _tableMap.value?.tables?.firstOrNull { it.id == tableId }?.seats ?: 2
        _guests.value = if (seats > 2) 2 else 1
        refreshNow()
    }

    fun closeTable() {
        resetOrderState()
        refreshNow()
    }

    private fun resetOrderState() {
        _selectedTableId.value = null
        _order.value = null
        _orderLoaded.value = false
        _cart.value = emptyList()
    }

    // ===== السلة =====

    fun addToCart(item: MenuItem, options: List<OrderOption> = emptyList()) {
        _cart.update { cart ->
            val line = CartLine(item.id, item.name, item.price, options, 1)
            val hit = cart.firstOrNull { it.key == line.key && it.notes.isEmpty() }
            if (hit != null) cart.map { if (it === hit) it.copy(quantity = it.quantity + 1) else it } else cart + line
        }
    }

    fun changeQuantity(line: CartLine, delta: Int) {
        _cart.update { cart ->
            cart.mapNotNull {
                if (it === line) it.copy(quantity = it.quantity + delta).takeIf { l -> l.quantity > 0 } else it
            }
        }
    }

    fun setNote(line: CartLine, note: String) {
        _cart.update { cart -> cart.map { if (it === line) it.copy(notes = note.take(200)) else it } }
    }

    fun clearCart() { _cart.value = emptyList() }

    fun setGuests(n: Int) { _guests.value = n.coerceIn(1, 50) }

    // ===== إجراءات الطلب =====

    fun sendCart() {
        val tableId = _selectedTableId.value ?: return
        val cart = _cart.value
        if (cart.isEmpty()) return
        act("تم إرسال الطلب للمطبخ") {
            _order.value = repository.sendToKitchen(tableId, _guests.value, cart)
            _orderLoaded.value = true
            _cart.value = emptyList()
        }
    }

    fun approve(item: OrderItem) {
        val o = _order.value ?: return
        act("تمت الموافقة وأُرسل للمطبخ") { _order.value = repository.approveItem(o.id, item.id) }
    }

    fun serve(item: OrderItem) = act("تم التقديم") { repository.serveItem(item.id) }

    fun cancel(item: OrderItem, reason: String) {
        val o = _order.value ?: return
        act("تم الإلغاء") { _order.value = repository.cancelItem(o.id, item.id, reason.trim()) }
    }

    fun requestBill() {
        val o = _order.value ?: return
        act("تم طلب الفاتورة") { _order.value = repository.requestBill(o.id) }
    }

    fun reopen() {
        val o = _order.value ?: return
        act("أُعيد فتح الطلب") { _order.value = repository.reopen(o.id) }
    }

    fun transfer(toTableId: String) {
        val o = _order.value ?: return
        act("تم نقل الطلب") {
            repository.transfer(o.id, toTableId)
            resetOrderState()
        }
    }

    fun resolveCalls(tableId: String) {
        val calls = _tableMap.value?.tables?.firstOrNull { it.id == tableId }?.calls ?: return
        act("تمت تلبية النداء") { calls.forEach { repository.resolveCall(it.id) } }
    }

    fun freeTable(tableId: String) = act("الطاولة فارغة") { repository.setTableStatus(tableId, "free") }
}

class CaptainViewModelFactory(private val repository: CaptainRepository) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T = CaptainViewModel(repository) as T
}
