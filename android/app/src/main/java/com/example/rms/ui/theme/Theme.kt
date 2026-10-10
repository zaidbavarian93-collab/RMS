package com.example.rms.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp

private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFFB7A6FF),
    onPrimary = Space,
    primaryContainer = Color(0x557C5CF0),
    onPrimaryContainer = DarkTextPrimary,
    secondary = Cyan,
    secondaryContainer = Color(0x4422A6C7),
    onSecondaryContainer = DarkTextPrimary,
    tertiary = Gold,
    background = DarkBackground,
    surface = GlassDark,
    surfaceVariant = DarkSurfaceVariant,
    surfaceContainerHigh = Color(0xF21A2646),
    onBackground = DarkTextPrimary,
    onSurface = DarkTextPrimary,
    outline = DarkBorder
)

private val LightColorScheme = lightColorScheme(
    primary = Indigo,
    onPrimary = LightSurface,
    primaryContainer = Color(0xFFE6E1FF),
    onPrimaryContainer = Navy,
    secondary = Cyan,
    secondaryContainer = Color(0xCCE4DEFF),
    onSecondaryContainer = Navy,
    tertiary = Gold,
    background = LightBackground,
    surface = GlassLight,
    surfaceVariant = LightSurfaceVariant,
    surfaceContainerHigh = Color(0xF2F7F8FF),
    onBackground = TextPrimary,
    onSurface = TextPrimary,
    outline = LightBorder
)

// زوايا مستديرة واسعة كقطرات الزجاج
private val LiquidShapes = Shapes(
    extraSmall = RoundedCornerShape(10.dp),
    small = RoundedCornerShape(14.dp),
    medium = RoundedCornerShape(18.dp),
    large = RoundedCornerShape(24.dp),
    extraLarge = RoundedCornerShape(30.dp)
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
    // شريط الحالة: enableEdgeToEdge() في MainActivity يجعله شفافًا فوق خلفية السماء ويضبط لون أيقوناته تلقائيًا
    MaterialTheme(colorScheme = colorScheme, typography = SerifTypography, shapes = LiquidShapes, content = content)
}
