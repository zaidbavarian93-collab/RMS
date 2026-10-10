package com.example.rms.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.rms.ui.components.BrandLogo
import com.example.rms.ui.theme.AmberPrimary
import com.example.rms.ui.theme.BrownDeep
import com.example.rms.ui.theme.StatusDanger
import com.example.rms.ui.viewmodel.CaptainViewModel

@Composable
fun LoginScreen(viewModel: CaptainViewModel) {
    var serverUrl by remember { mutableStateOf(viewModel.defaultBaseUrl) }
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showServer by remember { mutableStateOf(false) }
    val busy by viewModel.authBusy.collectAsState()
    val error by viewModel.authError.collectAsState()

    val brand by viewModel.brand.collectAsState()
    AuthScaffold(title = brand.displayName, subtitle = "تطبيق الكابتن — سجّل الدخول بحسابك", logoUrl = brand.logoUrl) {
        error?.let { Text(text = it, color = StatusDanger, fontSize = 13.sp) }
        OutlinedTextField(
            value = username,
            onValueChange = { username = it },
            label = { Text("اسم المستخدم") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("كلمة المرور") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth()
        )
        if (showServer) {
            OutlinedTextField(
                value = serverUrl,
                onValueChange = { serverUrl = it },
                label = { Text("عنوان الخادم") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                modifier = Modifier.fillMaxWidth()
            )
        }
        Button(
            onClick = { viewModel.login(serverUrl, username, password) },
            enabled = !busy,
            modifier = Modifier.fillMaxWidth()
        ) {
            if (busy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Text("دخول")
        }
        TextButton(onClick = { showServer = !showServer }, modifier = Modifier.fillMaxWidth()) {
            Text(if (showServer) "إخفاء إعدادات الخادم" else "إعدادات الخادم")
        }
    }
}

@Composable
fun ChangePasswordScreen(viewModel: CaptainViewModel) {
    var current by remember { mutableStateOf("") }
    var next by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    val busy by viewModel.authBusy.collectAsState()
    val error by viewModel.authError.collectAsState()

    val brand by viewModel.brand.collectAsState()
    AuthScaffold(title = "تغيير كلمة المرور", subtitle = "${brand.displayName} — يجب تغيير كلمة المرور قبل المتابعة", logoUrl = brand.logoUrl) {
        error?.let { Text(text = it, color = StatusDanger, fontSize = 13.sp) }
        for ((value, label, setter) in listOf(
            Triple(current, "كلمة المرور الحالية", { v: String -> current = v }),
            Triple(next, "كلمة المرور الجديدة (8 أحرف على الأقل)", { v: String -> next = v }),
            Triple(confirm, "تأكيد كلمة المرور", { v: String -> confirm = v })
        )) {
            OutlinedTextField(
                value = value,
                onValueChange = setter,
                label = { Text(label) },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                modifier = Modifier.fillMaxWidth()
            )
        }
        Button(onClick = { viewModel.changePassword(current, next, confirm) }, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
            if (busy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Text("حفظ")
        }
        TextButton(onClick = { viewModel.logout() }, modifier = Modifier.fillMaxWidth()) { Text("تسجيل الخروج") }
    }
}

@Composable
private fun AuthScaffold(title: String, subtitle: String, logoUrl: String?, content: @Composable () -> Unit) {
    Box(
        Modifier
            .fillMaxSize()
            .background(Brush.linearGradient(listOf(BrownDeep, AmberPrimary)))
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        contentAlignment = Alignment.Center
    ) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(Modifier.padding(22.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { BrandLogo(logoUrl, 72.dp) }
                Text(title, fontSize = 22.sp, fontWeight = FontWeight.Bold, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
                Text(subtitle, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f), modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
                content()
            }
        }
    }
}
