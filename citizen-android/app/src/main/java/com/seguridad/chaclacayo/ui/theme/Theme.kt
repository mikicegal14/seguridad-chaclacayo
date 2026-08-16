package com.seguridad.chaclacayo.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Premium PWA-aligned Color Scheme
val BgDark = Color(0xFF121824)
val CardDark = Color(0xFF1E293B)
val BorderDark = Color(0xFF334155)

val Primary = Color(0xFF8B5CF6)
val PrimaryPastel = Color(0xFFC084FC)
val Secondary = Color(0xFFEC4899)
val SecondaryPastel = Color(0xFFF472B6)

val Slate100 = Color(0xFFF1F5F9)
val Slate300 = Color(0xFFCBD5E1)
val Slate400 = Color(0xFF94A3B8)
val Slate500 = Color(0xFF64748B)

private val DarkColorScheme = darkColorScheme(
    primary = PrimaryPastel,
    secondary = SecondaryPastel,
    background = BgDark,
    surface = CardDark,
    onPrimary = Color.White,
    onSecondary = Color.White,
    onBackground = Slate100,
    onSurface = Slate100,
    outline = BorderDark
)

@Composable
fun ChaclacayoAlertaTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        content = content
    )
}
