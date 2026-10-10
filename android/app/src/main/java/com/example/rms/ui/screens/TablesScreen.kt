@file:OptIn(ExperimentalMaterial3Api::class)

package com.example.rms.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.rms.data.model.DiningTable
import com.example.rms.data.model.minutesSince
import com.example.rms.ui.components.BrandLogo
import com.example.rms.ui.components.MutedText
import com.example.rms.ui.components.money
import com.example.rms.ui.components.tableColors
import com.example.rms.ui.components.tableStatusLabel
import com.example.rms.ui.components.timeLabel
import com.example.rms.ui.theme.StatusDanger
import com.example.rms.ui.theme.TextPrimary
import com.example.rms.ui.viewmodel.CaptainViewModel

// شاشة الطاولات: خريطة الصالة بالألوان + تنبيهات (نداء / صنف جاهز / طلب زبون بانتظار الموافقة)
@Composable
fun TablesScreen(viewModel: CaptainViewModel) {
    val map by viewModel.tableMap.collectAsState()
    val user by viewModel.user.collectAsState()
    val offline by viewModel.offline.collectAsState()
    val brand by viewModel.brand.collectAsState()
    var floorId by remember { mutableStateOf<String?>(null) }

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent),
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        BrandLogo(brand.logoUrl, 36.dp)
                        Column {
                            Text(brand.displayName, fontWeight = FontWeight.Bold, maxLines = 1)
                            MutedText("الطاولات" + (user?.let { " · ${it.fullName}" } ?: ""))
                        }
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.refreshNow() }) { Icon(Icons.Default.Refresh, contentDescription = "تحديث") }
                    IconButton(onClick = { viewModel.logout() }) { Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = "خروج") }
                }
            )
        }
    ) { padding ->
        val m = map
        if (m == null) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            return@Scaffold
        }
        val tables = m.tables.filter { floorId == null || it.floorId == floorId }
        val alerts = m.tables.filter { it.needsAttention }

        Column(Modifier.padding(padding)) {
            if (offline) {
                Text(
                    "لا يوجد اتصال بالخادم — جارٍ إعادة المحاولة…",
                    color = Color.White, fontSize = 13.sp, textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().background(StatusDanger).padding(vertical = 6.dp)
                )
            }
            // ملخص الحالات
            LazyRow(contentPadding = PaddingValues(horizontal = 12.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                items(listOf("free", "occupied", "billing", "reserved", "cleaning")) { s ->
                    val (bg, border) = tableColors(s)
                    AssistChip(
                        onClick = {},
                        label = { Text("${tableStatusLabel(s)} ${m.tables.count { it.status == s }}", fontSize = 12.sp) },
                        border = BorderStroke(1.dp, border),
                        colors = AssistChipDefaults.assistChipColors(containerColor = bg, labelColor = TextPrimary)
                    )
                }
            }
            // طاولات تحتاج انتباهًا
            if (alerts.isNotEmpty()) {
                LazyRow(contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(alerts) { t ->
                        AssistChip(
                            onClick = { viewModel.openTable(t.id) },
                            label = { Text("طاولة ${t.number}: " + attentionText(t), fontSize = 12.sp) }
                        )
                    }
                }
            }
            // القاعات
            LazyRow(contentPadding = PaddingValues(horizontal = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                item { FilterChip(selected = floorId == null, onClick = { floorId = null }, label = { Text("الكل") }) }
                items(m.floors) { f -> FilterChip(selected = floorId == f.id, onClick = { floorId = f.id }, label = { Text(f.name) }) }
            }
            LazyVerticalGrid(
                columns = GridCells.Adaptive(140.dp),
                contentPadding = PaddingValues(12.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(tables, key = { it.id }) { t -> TableCard(t) { viewModel.openTable(t.id) } }
            }
        }
    }
}

private fun attentionText(t: DiningTable): String = buildList {
    if (t.calls.isNotEmpty()) add("🔔 نداء")
    (t.order?.ready ?: 0).takeIf { it > 0 }?.let { add("✅ $it جاهز") }
    (t.order?.pendingApproval ?: 0).takeIf { it > 0 }?.let { add("📱 $it بانتظار الموافقة") }
}.joinToString(" ")

@Composable
private fun TableCard(t: DiningTable, onClick: () -> Unit) {
    val (bg, border) = tableColors(t.status)
    Card(
        onClick = onClick,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = bg.copy(alpha = 0.72f), contentColor = TextPrimary),
        border = BorderStroke(2.dp, if (t.needsAttention) StatusDanger else border),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            Modifier.fillMaxWidth().padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                if (t.calls.isNotEmpty()) Text("🔔")
                if ((t.order?.ready ?: 0) > 0) Text("✅")
                if ((t.order?.pendingApproval ?: 0) > 0) Text("📱")
            }
            Text(t.number, fontSize = 30.sp, fontWeight = FontWeight.ExtraBold)
            Text("${tableStatusLabel(t.status)} · ${t.seats} مقاعد", fontSize = 12.sp, color = Color(0xFF6B5F52))
            t.order?.let { o ->
                Text(money(o.total), fontWeight = FontWeight.Bold)
                Text(timeLabel(minutesSince(o.openedAt)) + (o.captainName?.let { " · $it" } ?: ""), fontSize = 11.sp, color = Color(0xFF6B5F52))
            }
        }
    }
}
