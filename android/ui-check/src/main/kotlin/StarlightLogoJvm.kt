package com.example.rms.ui.components

import androidx.compose.foundation.Image
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toComposeImageBitmap

// نسخة JVM من StarlightLogo (الأصلية تقرأ R.drawable)
@Composable
fun StarlightLogo(modifier: Modifier = Modifier) {
    val img = remember {
        val bytes = Thread.currentThread().contextClassLoader.getResourceAsStream("starlight_logo.png")!!.readBytes()
        org.jetbrains.skia.Image.makeFromEncoded(bytes).toComposeImageBitmap()
    }
    Image(img, contentDescription = "Starlight", modifier = modifier)
}
