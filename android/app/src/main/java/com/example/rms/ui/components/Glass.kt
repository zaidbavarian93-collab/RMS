package com.example.rms.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import com.example.rms.ui.theme.Cyan
import com.example.rms.ui.theme.Gold
import com.example.rms.ui.theme.Navy
import com.example.rms.ui.theme.SkyDark
import com.example.rms.ui.theme.SkyLight
import com.example.rms.ui.theme.StatusDanger
import com.example.rms.ui.theme.Violet

/* =====================================================================
   Liquid Glass بهوية Starlight
   - الخلفية: سماء بسُدم بنفسجية/فيروزية/ذهبية وشبكة نجوم كحرف S في الشعار
   - الأسطح: زجاج شفاف بتدرّج، حافة لامعة (أفتح في الأعلى)، ولمعة عاكسة علوية
   ملاحظة: أندرويد لا يوفّر ضبابية لما خلف العنصر، لذلك نحاكي الزجاج بالشفافية واللمعة
   والحافة المضيئة، ونتجنب ظلال الارتفاع التي تظهر كإطار داكن عبر الأسطح الشفافة.
   ===================================================================== */

// نقاط شبكة النجوم كنِسَب من حجم الشاشة، والخطوط بينها
private val stars = listOf(
    Offset(.08f, .10f), Offset(.30f, .05f), Offset(.46f, .16f), Offset(.66f, .11f), Offset(.86f, .20f),
    Offset(.42f, .32f), Offset(.62f, .39f), Offset(.84f, .35f), Offset(.22f, .27f),
    Offset(.14f, .72f), Offset(.34f, .80f), Offset(.56f, .76f), Offset(.78f, .86f), Offset(.92f, .70f)
)
private val links = listOf(0 to 1, 1 to 2, 2 to 3, 3 to 4, 2 to 5, 5 to 6, 6 to 7, 7 to 4, 1 to 8, 8 to 5, 8 to 0, 3 to 6, 9 to 10, 10 to 11, 11 to 12, 12 to 13, 11 to 6, 13 to 7)
private val starColors = listOf(Gold, Violet, Cyan)

private fun DrawScope.nebula(center: Offset, radius: Float, color: Color) {
    drawCircle(Brush.radialGradient(listOf(color, Color.Transparent), center, radius), radius, center)
}

@Composable
fun StarlightBackground(modifier: Modifier = Modifier, content: @Composable BoxScope.() -> Unit) {
    val dark = isSystemInDarkTheme()
    val line = if (dark) Color.White.copy(alpha = .10f) else Navy.copy(alpha = .13f)
    Box(
        modifier
            .background(Brush.linearGradient(if (dark) SkyDark else SkyLight))
            .drawBehind {
                val w = size.width; val h = size.height; val m = maxOf(w, h)
                nebula(Offset(w, 0f), m * .55f, Violet.copy(alpha = if (dark) .45f else .32f))
                nebula(Offset(0f, h), m * .5f, Cyan.copy(alpha = if (dark) .35f else .28f))
                nebula(Offset(w * .75f, h * .72f), m * .32f, Gold.copy(alpha = if (dark) .18f else .22f))
                if (!dark) nebula(Offset(w * .2f, h * .15f), m * .35f, Color.White.copy(alpha = .8f))
                val pts = stars.map { Offset(it.x * w, it.y * h) }
                links.forEach { (a, b) -> drawLine(line, pts[a], pts[b], strokeWidth = 1.2.dp.toPx()) }
                pts.forEachIndexed { i, p ->
                    val c = starColors[i % starColors.size]
                    val r = (if (i % 4 == 0) 11 else 7).dp.toPx()
                    drawCircle(Brush.radialGradient(listOf(Color.White, c.copy(alpha = .7f), Color.Transparent), p, r), r, p)
                    drawCircle(if (dark) Color.White.copy(alpha = .8f) else Navy.copy(alpha = .55f), 1.6.dp.toPx(), p)
                }
                // نجمة رباعية كنجمة الشعار
                val s = Offset(w * .9f, h * .07f); val k = 9.dp.toPx()
                val star = Path().apply {
                    moveTo(s.x, s.y - k); quadraticTo(s.x, s.y, s.x + k, s.y); quadraticTo(s.x, s.y, s.x, s.y + k)
                    quadraticTo(s.x, s.y, s.x - k, s.y); quadraticTo(s.x, s.y, s.x, s.y - k); close()
                }
                drawPath(star, if (dark) Color.White.copy(alpha = .7f) else Navy.copy(alpha = .45f))
            }
    ) {
        // لون النص الافتراضي حسب السمة (كان يوفّره Surface سابقًا)
        CompositionLocalProvider(LocalContentColor provides MaterialTheme.colorScheme.onBackground) { content() }
    }
}

// سطح زجاجي سائل: تدرّج شفاف + لمعة علوية + حافة مضيئة
fun Modifier.liquidGlass(
    shape: Shape = RoundedCornerShape(22.dp),
    tint: Color = Color.White,
    dark: Boolean = false,
    rim: Color? = null,
    strength: Float = 1f
): Modifier {
    val top = if (dark) .22f else .74f
    val bottom = if (dark) .10f else .46f
    return this
        .clip(shape)
        .background(Brush.verticalGradient(listOf(tint.copy(alpha = (top * strength).coerceAtMost(1f)), tint.copy(alpha = (bottom * strength).coerceAtMost(1f)))))
        .drawBehind {
            // لمعة عاكسة: انحناء الضوء عند الحافة العلوية
            drawRect(Brush.radialGradient(listOf(Color.White.copy(alpha = if (dark) .14f else .5f), Color.Transparent), Offset(size.width * .15f, -size.height * .1f), size.maxDimension * .7f))
        }
        .border(
            1.dp,
            if (rim != null) Brush.verticalGradient(listOf(Color.White.copy(alpha = .9f), rim))
            else Brush.verticalGradient(listOf(Color.White.copy(alpha = if (dark) .45f else .95f), Color.White.copy(alpha = if (dark) .10f else .35f))),
            shape
        )
}

@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(22.dp),
    tint: Color = Color.White,
    rim: Color? = null,
    onClick: (() -> Unit)? = null,
    enabled: Boolean = true,
    content: @Composable ColumnScope.() -> Unit
) {
    val dark = isSystemInDarkTheme()
    Column(
        modifier
            .liquidGlass(shape, if (dark && tint == Color.White) Color.White else tint, dark && tint == Color.White, rim)
            .then(if (onClick != null) Modifier.clickable(enabled = enabled, onClick = onClick) else Modifier),
        content = content
    )
}

// زر كبسولة زجاجي بتدرّج الكحلي → البنفسجي (أو أحمر للإجراءات الخطرة)
@Composable
fun LiquidButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    danger: Boolean = false,
    contentPadding: PaddingValues = ButtonDefaults.ContentPadding,
    content: @Composable RowScope.() -> Unit
) {
    val colors = if (danger) listOf(Color(0xFFE5484D), StatusDanger) else listOf(Navy, Violet)
    val shape = RoundedCornerShape(50)
    Button(
        onClick = onClick,
        enabled = enabled,
        shape = shape,
        contentPadding = contentPadding,
        colors = ButtonDefaults.buttonColors(
            containerColor = Color.Transparent, contentColor = Color.White,
            disabledContainerColor = Color.Transparent, disabledContentColor = Color.White.copy(alpha = .8f)
        ),
        modifier = modifier
            .alpha(if (enabled) 1f else .55f)
            .clip(shape)
            .background(Brush.linearGradient(colors))
            .drawBehind {
                // لمعة علوية على نصف الكبسولة
                drawRoundRect(
                    Brush.verticalGradient(listOf(Color.White.copy(alpha = .45f), Color.Transparent), endY = size.height * .55f),
                    topLeft = Offset(size.width * .06f, 1.dp.toPx()),
                    size = androidx.compose.ui.geometry.Size(size.width * .88f, size.height * .5f),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(size.height / 2)
                )
            }
            .border(1.dp, Brush.verticalGradient(listOf(Color.White.copy(alpha = .6f), Color.White.copy(alpha = .12f))), shape),
        content = content
    )
}
