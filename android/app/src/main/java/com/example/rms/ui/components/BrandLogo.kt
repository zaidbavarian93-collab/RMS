package com.example.rms.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.sp

/** شعار المطعم من إعدادات النظام، أو 🍽️ إن لم يُرفع شعار أو تعذّر تحميله. */
@Composable
fun BrandLogo(url: String?, size: Dp, modifier: Modifier = Modifier) {
    val image by produceState<ImageBitmap?>(initialValue = null, url) { value = url?.let { loadRemoteImage(it) } }
    val shape = RoundedCornerShape(size * 0.22f)
    val img = image
    if (img != null) {
        Image(
            bitmap = img,
            contentDescription = "شعار المطعم",
            contentScale = ContentScale.Fit,
            modifier = modifier.size(size).clip(shape).background(Color.White.copy(alpha = 0.92f)).padding(size * 0.06f),
        )
    } else {
        Box(modifier.size(size), contentAlignment = Alignment.Center) {
            Text("🍽️", fontSize = (size.value * 0.62f).sp)
        }
    }
}
