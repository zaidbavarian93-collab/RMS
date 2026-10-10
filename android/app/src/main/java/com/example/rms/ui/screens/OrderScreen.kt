@file:OptIn(ExperimentalMaterial3Api::class)

package com.example.rms.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.rms.data.model.CartLine
import com.example.rms.data.model.DiningTable
import com.example.rms.data.model.MenuItem
import com.example.rms.data.model.Order
import com.example.rms.data.model.OrderItem
import com.example.rms.data.model.minutesSince
import com.example.rms.ui.components.GlassCard
import com.example.rms.ui.components.LiquidButton
import com.example.rms.ui.components.MutedText
import com.example.rms.ui.components.liquidGlass
import com.example.rms.ui.components.StatusChip
import com.example.rms.ui.components.callKindLabel
import com.example.rms.ui.components.itemStatusColors
import com.example.rms.ui.components.itemStatusLabel
import com.example.rms.ui.components.money
import com.example.rms.ui.components.timeLabel
import com.example.rms.ui.theme.StatusDanger
import com.example.rms.ui.theme.StatusInfo
import com.example.rms.ui.theme.StatusInfoBg
import com.example.rms.ui.theme.StatusWarning
import com.example.rms.ui.theme.StatusWarningBg
import com.example.rms.ui.viewmodel.CaptainViewModel

// شاشة طلب الطاولة: الطلب الحالي + إضافة أصناف من المنيو + سلة الإرسال للمطبخ + الفاتورة
@Composable
fun OrderScreen(viewModel: CaptainViewModel) {
    val tableId by viewModel.selectedTableId.collectAsState()
    val map by viewModel.tableMap.collectAsState()
    val order by viewModel.order.collectAsState()
    val orderLoaded by viewModel.orderLoaded.collectAsState()
    val menu by viewModel.menu.collectAsState()
    val cart by viewModel.cart.collectAsState()
    val guests by viewModel.guests.collectAsState()

    val table = map?.tables?.firstOrNull { it.id == tableId }
    BackHandler { viewModel.closeTable() }
    if (table == null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        return
    }

    var categoryId by remember { mutableStateOf<String?>(null) }
    var search by remember { mutableStateOf("") }
    var picking by remember { mutableStateOf<MenuItem?>(null) }
    var cancelling by remember { mutableStateOf<OrderItem?>(null) }
    var transferOpen by remember { mutableStateOf(false) }

    val activeCategory = menu.firstOrNull { it.id == categoryId } ?: menu.firstOrNull()
    val visibleItems = if (search.isBlank()) activeCategory?.items.orEmpty()
    else menu.flatMap { it.items }.filter { it.name.contains(search.trim()) }
    val billing = order?.isBilling == true

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent),
                modifier = Modifier.liquidGlass(RoundedCornerShape(bottomStart = 26.dp, bottomEnd = 26.dp), dark = isSystemInDarkTheme()),
                navigationIcon = {
                    IconButton(onClick = { viewModel.closeTable() }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "رجوع") }
                },
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("طاولة ${table.number}", fontWeight = FontWeight.Bold)
                        order?.let { MutedText("#${it.number} · " + timeLabel(minutesSince(it.createdAt))) }
                    }
                },
                actions = { if (billing) StatusChip("طُلبت الفاتورة", StatusWarningBg, StatusWarning, Modifier.padding(end = 8.dp)) }
            )
        },
        bottomBar = {
            if (cart.isNotEmpty()) {
                CartBar(
                    cart = cart,
                    showGuests = order == null,
                    guests = guests,
                    onGuests = viewModel::setGuests,
                    onQuantity = viewModel::changeQuantity,
                    onNote = viewModel::setNote,
                    onClear = viewModel::clearCart,
                    onSend = viewModel::sendCart
                )
            }
        }
    ) { padding ->
        LazyColumn(
            Modifier.padding(padding).fillMaxSize(),
            contentPadding = PaddingValues(12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            if (table.calls.isNotEmpty()) {
                item {
                    GlassCard(tint = StatusWarningBg, rim = StatusWarning.copy(alpha = .5f)) {
                        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                "🔔 الزبون ينادي: " + table.calls.joinToString("، ") { callKindLabel(it.kind) },
                                color = StatusWarning, modifier = Modifier.weight(1f)
                            )
                            LiquidButton(onClick = { viewModel.resolveCalls(table.id) }) { Text("تمت التلبية") }
                        }
                    }
                }
            }
            if (order == null && orderLoaded && (table.status == "cleaning" || table.status == "reserved")) {
                item {
                    GlassCard(tint = StatusInfoBg, rim = StatusInfo.copy(alpha = .4f)) {
                        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                if (table.status == "cleaning") "الطاولة قيد التنظيف" else "الطاولة محجوزة",
                                color = StatusInfo, modifier = Modifier.weight(1f)
                            )
                            LiquidButton(onClick = { viewModel.freeTable(table.id) }) { Text("تحويلها إلى فارغة") }
                        }
                    }
                }
            }

            item {
                OrderCard(
                    order = order,
                    loaded = orderLoaded,
                    billing = billing,
                    onApprove = viewModel::approve,
                    onServe = viewModel::serve,
                    onCancel = { item ->
                        // الأصناف غير المرسلة تُلغى مباشرة؛ بعد الإرسال يلزم سبب للتدقيق
                        if (item.status == "draft" || item.status == "awaiting_approval") viewModel.cancel(item, "") else cancelling = item
                    },
                    onRequestBill = viewModel::requestBill,
                    onReopen = viewModel::reopen,
                    onTransfer = { transferOpen = true }
                )
            }

            if (!billing) {
                item {
                    OutlinedTextField(
                        value = search,
                        onValueChange = { search = it },
                        label = { Text("🔍 ابحث عن صنف") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
                if (search.isBlank()) {
                    item {
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(menu) { c ->
                                FilterChip(selected = c.id == activeCategory?.id, onClick = { categoryId = c.id }, label = { Text(c.name) })
                            }
                        }
                    }
                }
                items(visibleItems, key = { it.id }) { m ->
                    MenuRow(m) { if (m.options.isEmpty()) viewModel.addToCart(m) else picking = m }
                }
            }
        }
    }

    picking?.let { item ->
        OptionsDialog(
            item = item,
            onDismiss = { picking = null },
            onConfirm = { chosen -> viewModel.addToCart(item, chosen); picking = null }
        )
    }
    cancelling?.let { item ->
        CancelDialog(
            itemName = item.name,
            onDismiss = { cancelling = null },
            onConfirm = { reason -> viewModel.cancel(item, reason); cancelling = null }
        )
    }
    if (transferOpen) {
        val free = map?.tables.orEmpty().filter { it.status == "free" && it.id != table.id }
        TransferDialog(
            tables = free,
            onDismiss = { transferOpen = false },
            onPick = { viewModel.transfer(it.id); transferOpen = false }
        )
    }
}

@Composable
private fun OrderCard(
    order: Order?,
    loaded: Boolean,
    billing: Boolean,
    onApprove: (OrderItem) -> Unit,
    onServe: (OrderItem) -> Unit,
    onCancel: (OrderItem) -> Unit,
    onRequestBill: () -> Unit,
    onReopen: () -> Unit,
    onTransfer: () -> Unit
) {
    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("الطلب الحالي", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            val live = order?.liveItems.orEmpty()
            when {
                !loaded -> CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                order == null -> MutedText("لا توجد أصناف بعد — اختر من المنيو أدناه")
                live.isEmpty() -> MutedText("لا توجد أصناف بعد — اختر من المنيو أدناه")
                else -> {
                    val awaiting = live.count { it.status == "awaiting_approval" }
                    if (awaiting > 0) {
                        Text("📱 $awaiting صنف من الزبون بانتظار موافقتك", color = StatusWarning, fontSize = 13.sp)
                    }
                    live.forEachIndexed { index, item ->
                        if (index > 0) HorizontalDivider()
                        OrderItemRow(item, billing, onApprove, onServe, onCancel)
                    }
                    HorizontalDivider()
                    TotalRow("المجموع", order.subtotal)
                    if (order.discount > 0) TotalRow("خصم", -order.discount)
                    if (order.serviceAmount > 0) TotalRow("خدمة", order.serviceAmount)
                    if (order.taxAmount > 0) TotalRow("ضريبة", order.taxAmount)
                    TotalRow("الإجمالي", order.total, bold = true)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (billing) {
                            OutlinedButton(onClick = onReopen) { Text("إعادة فتح الطلب") }
                        } else {
                            LiquidButton(onClick = onRequestBill) { Text("🧾 طلب الفاتورة") }
                            FilledTonalButton(onClick = onTransfer) {
                                Icon(Icons.Default.SwapHoriz, contentDescription = null, Modifier.size(18.dp))
                                Text(" نقل")
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun OrderItemRow(
    item: OrderItem,
    billing: Boolean,
    onApprove: (OrderItem) -> Unit,
    onServe: (OrderItem) -> Unit,
    onCancel: (OrderItem) -> Unit
) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("${item.quantity}× ${item.name}", fontWeight = FontWeight.SemiBold)
            if (item.options.isNotEmpty()) MutedText(item.options.joinToString("، ") { it.name })
            item.notes?.let { MutedText("📝 $it") }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                val (bg, fg) = itemStatusColors(item.status)
                StatusChip(itemStatusLabel(item.status), bg, fg)
                if (item.source == "qr") StatusChip("QR", StatusInfoBg, StatusInfo)
            }
        }
        Text(money(item.lineTotal), fontWeight = FontWeight.Medium)
        when (item.status) {
            "awaiting_approval" -> FilledTonalButton(onClick = { onApprove(item) }, contentPadding = PaddingValues(horizontal = 10.dp)) {
                Icon(Icons.Default.Check, contentDescription = "موافقة", Modifier.size(18.dp))
                Text(" موافقة", fontSize = 13.sp)
            }
            "ready" -> FilledTonalButton(onClick = { onServe(item) }, contentPadding = PaddingValues(horizontal = 10.dp)) {
                Text("قدّمت ✔", fontSize = 13.sp)
            }
        }
        if (!billing) {
            IconButton(onClick = { onCancel(item) }) {
                Icon(Icons.Default.Close, contentDescription = "إلغاء", tint = StatusDanger)
            }
        }
    }
}

@Composable
private fun TotalRow(label: String, value: Double, bold: Boolean = false) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, fontWeight = if (bold) FontWeight.ExtraBold else FontWeight.Normal, fontSize = if (bold) 18.sp else 14.sp)
        Text(money(value), fontWeight = if (bold) FontWeight.ExtraBold else FontWeight.Normal, fontSize = if (bold) 18.sp else 14.sp)
    }
}

@Composable
private fun MenuRow(item: MenuItem, onClick: () -> Unit) {
    val alpha = if (item.isAvailable) 1f else 0.45f
    GlassCard(
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier.fillMaxWidth(),
        onClick = onClick,
        enabled = item.isAvailable
    ) {
        Row(Modifier.padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(item.name, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface.copy(alpha = alpha))
                if (item.options.isNotEmpty()) MutedText("خيارات: " + item.options.joinToString("، ") { it.name })
            }
            if (item.isAvailable) {
                Text(money(item.price), color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                Icon(Icons.Default.Add, contentDescription = "إضافة", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(start = 8.dp))
            } else {
                StatusChip("نفد", com.example.rms.ui.theme.StatusDangerBg, StatusDanger)
            }
        }
    }
}

@Composable
private fun CartBar(
    cart: List<CartLine>,
    showGuests: Boolean,
    guests: Int,
    onGuests: (Int) -> Unit,
    onQuantity: (CartLine, Int) -> Unit,
    onNote: (CartLine, String) -> Unit,
    onClear: () -> Unit,
    onSend: () -> Unit
) {
    // سلة الإرسال: لوح زجاجي سائل يطفو أسفل الشاشة
    Column(
        Modifier
            .navigationBarsPadding()
            .imePadding()
            .liquidGlass(RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp), dark = isSystemInDarkTheme(), strength = 1.35f)
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        run {
            Column(Modifier.heightIn(max = 220.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                cart.forEach { line ->
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Column(Modifier.weight(1f)) {
                            Text(line.name, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                            if (line.options.isNotEmpty()) MutedText(line.options.joinToString("، ") { it.name })
                            OutlinedTextField(
                                value = line.notes,
                                onValueChange = { onNote(line, it) },
                                placeholder = { Text("ملاحظة للمطبخ", fontSize = 12.sp) },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        IconButton(onClick = { onQuantity(line, -1) }) { Icon(Icons.Default.Remove, contentDescription = "إنقاص") }
                        Text("${line.quantity}", fontWeight = FontWeight.Bold)
                        IconButton(onClick = { onQuantity(line, 1) }) { Icon(Icons.Default.Add, contentDescription = "زيادة") }
                    }
                }
            }
            if (showGuests) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("عدد الضيوف")
                    IconButton(onClick = { onGuests(guests - 1) }) { Icon(Icons.Default.Remove, contentDescription = "إنقاص") }
                    Text("$guests", fontWeight = FontWeight.Bold)
                    IconButton(onClick = { onGuests(guests + 1) }) { Icon(Icons.Default.Add, contentDescription = "زيادة") }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LiquidButton(onClick = onSend, modifier = Modifier.weight(1f)) {
                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null, Modifier.size(18.dp))
                    Text(" إرسال للمطبخ (${money(cart.sumOf { it.lineTotal })})")
                }
                OutlinedButton(onClick = onClear) { Text("تفريغ") }
            }
        }
    }
}

@Composable
private fun OptionsDialog(item: MenuItem, onDismiss: () -> Unit, onConfirm: (List<com.example.rms.data.model.OrderOption>) -> Unit) {
    val chosen = remember { mutableStateListOf<String>() }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(item.name) },
        text = {
            Column {
                item.options.forEach { o ->
                    Row(
                        Modifier.fillMaxWidth().clickable { if (o.name in chosen) chosen.remove(o.name) else chosen.add(o.name) },
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Checkbox(checked = o.name in chosen, onCheckedChange = { if (it) chosen.add(o.name) else chosen.remove(o.name) })
                        Text(o.name + if (o.price > 0) "  +${money(o.price)}" else "")
                    }
                }
            }
        },
        confirmButton = { LiquidButton(onClick = { onConfirm(item.options.filter { it.name in chosen }) }) { Text("إضافة") } },
        containerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
        dismissButton = { TextButton(onClick = onDismiss) { Text("إلغاء") } }
    )
}

@Composable
private fun CancelDialog(itemName: String, onDismiss: () -> Unit, onConfirm: (String) -> Unit) {
    var reason by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("إلغاء \"$itemName\"") },
        text = {
            OutlinedTextField(value = reason, onValueChange = { reason = it }, label = { Text("سبب الإلغاء (مطلوب)") }, singleLine = true)
        },
        confirmButton = {
            LiquidButton(onClick = { onConfirm(reason) }, enabled = reason.isNotBlank(), danger = true) { Text("تأكيد الإلغاء") }
        },
        containerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
        dismissButton = { TextButton(onClick = onDismiss) { Text("رجوع") } }
    )
}

@Composable
private fun TransferDialog(tables: List<DiningTable>, onDismiss: () -> Unit, onPick: (DiningTable) -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("نقل الطلب إلى طاولة") },
        text = {
            if (tables.isEmpty()) {
                Text("لا توجد طاولات فارغة")
            } else {
                Column(Modifier.heightIn(max = 320.dp).verticalScroll(rememberScrollState())) {
                    tables.forEach { t ->
                        Text(
                            "طاولة ${t.number} · ${t.seats} مقاعد",
                            modifier = Modifier.fillMaxWidth().clickable { onPick(t) }.padding(vertical = 12.dp)
                        )
                        HorizontalDivider()
                    }
                }
            }
        },
        confirmButton = {},
        containerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
        dismissButton = { TextButton(onClick = onDismiss) { Text("إغلاق") } }
    )
}
