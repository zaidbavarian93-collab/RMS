// بدائل JVM لعناصر أندرويد القليلة التي تستخدمها الواجهة (للتجميع والرسم فقط)
package androidx.activity.compose

import androidx.compose.runtime.Composable

@Composable
fun BackHandler(enabled: Boolean = true, onBack: () -> Unit) {}
