package com.example.rms.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.font.FontFamily

private val DarkColorScheme = darkColorScheme(
    primary = AmberLight,
    onPrimary = BrownDeep,
    secondary = Green,
    background = DarkBackground,
    surface = GlassDark,
    surfaceVariant = DarkSurfaceVariant,
    onBackground = DarkTextPrimary,
    onSurface = DarkTextPrimary,
    outline = DarkBorder
)

private val LightColorScheme = lightColorScheme(
    primary = AmberPrimary,
    onPrimary = LightSurface,
    secondary = Green,
    background = LightBackground,
    surface = GlassLight,
    surfaceVariant = LightSurfaceVariant,
    onBackground = TextPrimary,
    onSurface = TextPrimary,
    outline = LightBorder
)

// خط بنمط Times New Roman: أندرويد لا يحوي Times New Roman، فنستخدم الخط المذيّل (Serif) للنظام
private val base = Typography()
private val SerifTypography = Typography(
    displayLarge = base.displayLarge.copy(fontFamily = FontFamily.Serif),
    displayMedium = base.displayMedium.copy(fontFamily = FontFamily.Serif),
    displaySmall = base.displaySmall.copy(fontFamily = FontFamily.Serif),
    headlineLarge = base.headlineLarge.copy(fontFamily = FontFamily.Serif),
    headlineMedium = base.headlineMedium.copy(fontFamily = FontFamily.Serif),
    headlineSmall = base.headlineSmall.copy(fontFamily = FontFamily.Serif),
    titleLarge = base.titleLarge.copy(fontFamily = FontFamily.Serif),
    titleMedium = base.titleMedium.copy(fontFamily = FontFamily.Serif),
    titleSmall = base.titleSmall.copy(fontFamily = FontFamily.Serif),
    bodyLarge = base.bodyLarge.copy(fontFamily = FontFamily.Serif),
    bodyMedium = base.bodyMedium.copy(fontFamily = FontFamily.Serif),
    bodySmall = base.bodySmall.copy(fontFamily = FontFamily.Serif),
    labelLarge = base.labelLarge.copy(fontFamily = FontFamily.Serif),
    labelMedium = base.labelMedium.copy(fontFamily = FontFamily.Serif),
    labelSmall = base.labelSmall.copy(fontFamily = FontFamily.Serif)
)

@Composable
fun RmsTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    // شريط الحالة: enableEdgeToEdge() في MainActivity يجعله شفافًا فوق الخلفية المتدرجة ويضبط لون أيقوناته تلقائيًا
    MaterialTheme(colorScheme = colorScheme, typography = SerifTypography, content = content)
}
