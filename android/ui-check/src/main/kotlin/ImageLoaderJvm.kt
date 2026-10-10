package com.example.rms.ui.components

import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.toComposeImageBitmap
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.URL

// نسخة JVM من loadRemoteImage (الأصلية تستخدم BitmapFactory الخاص بأندرويد)
suspend fun loadRemoteImage(url: String): ImageBitmap? = withContext(Dispatchers.IO) {
    runCatching { org.jetbrains.skia.Image.makeFromEncoded(URL(url).readBytes()).toComposeImageBitmap() }.getOrNull()
}
