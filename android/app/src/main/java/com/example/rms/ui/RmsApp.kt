package com.example.rms.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.key
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.example.rms.ui.screens.ChangePasswordScreen
import com.example.rms.ui.screens.LoginScreen
import com.example.rms.ui.screens.OrderScreen
import com.example.rms.ui.screens.TablesScreen
import com.example.rms.ui.theme.GlassTopDark
import com.example.rms.ui.theme.GlassTopLight
import com.example.rms.ui.viewmodel.CaptainViewModel

@Composable
fun RmsApp(viewModel: CaptainViewModel) {
    // الواجهة عربية بالكامل: نفرض اتجاه RTL مهما كانت لغة الجهاز
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        val user by viewModel.user.collectAsState()
        val message by viewModel.message.collectAsState()
        val loading by viewModel.loading.collectAsState()
        val snackbar = remember { SnackbarHostState() }

        LaunchedEffect(message) {
            message?.let {
                snackbar.showSnackbar(it)
                viewModel.consumeMessage()
            }
        }

        val gradient = if (isSystemInDarkTheme()) GlassTopDark else GlassTopLight
        Surface(
            modifier = Modifier.fillMaxSize().background(Brush.linearGradient(gradient)),
            color = Color.Transparent
        ) {
            Box(Modifier.fillMaxSize()) {
                val u = user
                when {
                    u == null -> LoginScreen(viewModel)
                    u.mustChangePassword -> ChangePasswordScreen(viewModel)
                    !viewModel.isAllowedRole -> NotAllowedScreen(viewModel)
                    // مفتاح المستخدم يعيد بناء الواجهة بالكامل عند تبديل الحساب
                    else -> key(u.id) { MainShell(viewModel) }
                }
                if (loading) LinearProgressIndicator(Modifier.fillMaxWidth().align(Alignment.TopCenter))
                SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter))
            }
        }
    }
}

@Composable
private fun MainShell(viewModel: CaptainViewModel) {
    val selected by viewModel.selectedTableId.collectAsState()
    if (selected == null) TablesScreen(viewModel) else OrderScreen(viewModel)
}

@Composable
private fun NotAllowedScreen(viewModel: CaptainViewModel) {
    Column(
        Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("هذا الحساب لا يملك صلاحية استخدام تطبيق الكابتن", textAlign = TextAlign.Center, style = MaterialTheme.typography.titleMedium)
        Text("استخدم حسابًا بدور كابتن أو كاشير أو مدير", textAlign = TextAlign.Center, modifier = Modifier.padding(vertical = 12.dp))
        Button(onClick = { viewModel.logout() }) { Text("تسجيل الخروج") }
    }
}
