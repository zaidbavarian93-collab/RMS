package com.example.rms.ui.components

import androidx.compose.foundation.Image
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import com.example.rms.R

// شعار Starlight للحلول التقنية (الشركة صاحبة النظام)
@Composable
fun StarlightLogo(modifier: Modifier = Modifier) {
    Image(painterResource(R.drawable.starlight_logo), contentDescription = "Starlight للحلول التقنية", modifier = modifier)
}
