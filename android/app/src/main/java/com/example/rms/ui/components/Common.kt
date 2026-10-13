package com.example.rms.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.rms.ui.theme.*
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale

private val moneyFormat = DecimalFormat("#,##0.##", DecimalFormatSymbols(Locale.US))
fun money(v: Double): String = moneyFormat.format(v)

fun tableStatusLabel(s: String) = when (s) {
    "free" -> "فارغة"
    "occupied" -> "مشغولة"
    "billing" -> "فاتورة"
    "reserved" -> "محجوزة"
    "cleaning" -> "تنظيف"
    else -> s
}

fun itemStatusLabel(s: String) = when (s) {
    "awaiting_approval" -> "بانتظار الموافقة"
    "draft" -> "مسودة"
    "pending" -> "في الانتظار"
    "preparing" -> "قيد التحضير"
    "ready" -> "جاهز"
    "served" -> "تم التقديم"
    "cancelled" -> "ملغى"
    else -> s
}

fun callKindLabel(k: String) = when (k) {
    "call_captain" -> "نداء الكابتن"
    "request_bill" -> "طلب الفاتورة"
    "water" -> "ماء"
    else -> k
}

fun timeLabel(minutes: Int?): String = when {
    minutes == null -> ""
    minutes < 1 -> "الآن"
    minutes < 60 -> "$minutes د"
    else -> "${minutes / 60} س ${minutes % 60} د"
}

// لون خلفية/حدود الطاولة حسب حالتها
fun tableColors(status: String): Pair<Color, Color> = when (status) {
    "free" -> TableFree to TableFreeBorder
    "occupied" -> TableOccupied to TableOccupiedBorder
    "billing" -> TableBilling to TableBillingBorder
    "reserved" -> TableReserved to TableReservedBorder
    else -> TableCleaning to TableCleaningBorder
}

fun itemStatusColors(status: String): Pair<Color, Color> = when (status) {
    "awaiting_approval" -> StatusWarningBg to StatusWarning
    "preparing" -> StatusWarningBg to StatusWarning
    "ready", "served" -> StatusSuccessBg to StatusSuccess
    "cancelled" -> StatusDangerBg to StatusDanger
    else -> LightSurfaceVariant to TextMuted
}

@Composable
fun StatusChip(text: String, bg: Color, fg: Color, modifier: Modifier = Modifier) {
    Text(
        text = text,
        color = fg,
        fontSize = 12.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = modifier
            .background(bg, RoundedCornerShape(50))
            .padding(horizontal = 10.dp, vertical = 3.dp)
    )
}

@Composable
fun MutedText(text: String, modifier: Modifier = Modifier) {
    Text(text = text, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f), fontSize = 13.sp, modifier = modifier)
}
