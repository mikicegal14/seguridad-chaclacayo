package com.seguridad.chaclacayo.ui.screens

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import coil.compose.AsyncImage
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.seguridad.chaclacayo.data.api.RetrofitClient
import com.seguridad.chaclacayo.data.api.SocketManager
import com.seguridad.chaclacayo.data.local.PrefsManager
import com.seguridad.chaclacayo.data.model.Alert
import com.seguridad.chaclacayo.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun DashboardScreen(
    prefsManager: PrefsManager,
    onLogout: () -> Unit,
    onNavigateToDetailedReport: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    
    var activeTab by remember { mutableStateOf("panic") }
    var alertsList by remember { mutableStateOf<List<Alert>>(emptyList()) }
    var isHistoryLoading by remember { mutableStateOf(false) }

    // Connect to WebSocket room
    LaunchedEffect(Unit) {
        val socketManager = SocketManager.getInstance(context)
        socketManager.connect()
        
        // Listen for realtime status updates
        launch {
            socketManager.statusUpdates.collect { (id, newStatus) ->
                alertsList = alertsList.map { alert ->
                    if (alert.id == id) alert.copy(estado = newStatus) else alert
                }
            }
        }
    }

    // Refresh history helper
    val refreshHistory: () -> Unit = {
        isHistoryLoading = true
        coroutineScope.launch {
            try {
                val response = RetrofitClient.getInstance(context).apiService.getMisReportes()
                if (response.isSuccessful && response.body() != null) {
                    alertsList = response.body()!!
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Error al cargar historial.", Toast.LENGTH_SHORT).show()
            } finally {
                isHistoryLoading = false
            }
        }
    }

    // Load initial history when switched to History tab
    LaunchedEffect(activeTab) {
        if (activeTab == "history") {
            refreshHistory()
        }
    }

    ScrollerLayout(
        prefsManager = prefsManager,
        onLogout = onLogout,
        activeTab = activeTab,
        onTabChanged = { activeTab = it }
    ) {
        if (activeTab == "panic") {
            PanicTab(
                context = context,
                onNavigateToDetailedReport = onNavigateToDetailedReport,
                refreshHistory = refreshHistory
            )
        } else {
            HistoryTab(
                alertsList = alertsList,
                isLoading = isHistoryLoading,
                serverUrl = prefsManager.serverUrl,
                onRefresh = { refreshHistory() }
            )
        }
    }
}

@Composable
fun ScrollerLayout(
    prefsManager: PrefsManager,
    onLogout: () -> Unit,
    activeTab: String,
    onTabChanged: (String) -> Unit,
    content: @Composable () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BgDark)
    ) {
        // Custom Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(CardDark.copy(alpha = 0.6f))
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Seguridad Vecinal",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Text(
                    text = "Chaclacayo Alerta · Ciudadano",
                    fontSize = 11.sp,
                    color = Slate400
                )
            }
            
            // Name & Logout
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = prefsManager.user?.nombre ?: "",
                    fontSize = 12.sp,
                    color = Slate300,
                    fontWeight = FontWeight.Bold
                )
                Button(
                    onClick = onLogout,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0x1AFF5555)),
                    border = BorderStroke(1.dp, Color(0x33FF5555)),
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                    modifier = Modifier.height(30.dp)
                ) {
                    Text("Salir", color = Color(0xFFFF8888), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        // Tab Navigation
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(CardDark.copy(alpha = 0.3f))
        ) {
            // Panic Button Tab
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clickable { onTabChanged("panic") }
                    .padding(vertical = 12.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "🚨 Botón de Pánico",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (activeTab == "panic") PrimaryPastel else Slate400
                    )
                    if (activeTab == "panic") {
                        Spacer(modifier = Modifier.height(4.dp))
                        Box(modifier = Modifier.width(40.dp).height(2.dp).background(PrimaryPastel))
                    }
                }
            }

            // History Tab
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clickable { onTabChanged("history") }
                    .padding(vertical = 12.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "📋 Mis Reportes",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (activeTab == "history") PrimaryPastel else Slate400
                    )
                    if (activeTab == "history") {
                        Spacer(modifier = Modifier.height(4.dp))
                        Box(modifier = Modifier.width(40.dp).height(2.dp).background(PrimaryPastel))
                    }
                }
            }
        }

        // Main Screen Content
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
        ) {
            content()
        }

        // Footer
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(CardDark.copy(alpha = 0.3f))
                .border(BorderStroke(0.5.dp, BorderDark.copy(alpha = 0.4f)))
                .padding(vertical = 10.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "© 2026 Municipalidad de Chaclacayo · Seguridad",
                fontSize = 10.sp,
                color = Slate500
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PanicTab(
    context: Context,
    onNavigateToDetailedReport: () -> Unit,
    refreshHistory: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    var isLoading by remember { mutableStateOf(false) }
    var feedbackMsg by remember { mutableStateOf<String?>(null) }
    var feedbackType by remember { mutableStateOf("success") }

    // GPS location fetching helper
    val fusedLocationClient = remember { LocationServices.getFusedLocationProviderClient(context) }

    val requestPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        val coarseGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] ?: false
        if (fineGranted || coarseGranted) {
            // Trigger emergency process if permissions are granted
            Toast.makeText(context, "Permisos de ubicación concedidos. Enviando alerta...", Toast.LENGTH_SHORT).show()
        } else {
            feedbackType = "error"
            feedbackMsg = "Permiso de GPS denegado. Habilite la geolocalización para poder emitir la alerta."
        }
    }

    val triggerPanicAlert = {
        isLoading = true
        feedbackMsg = null

        val hasFine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val hasCoarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

        if (!hasFine && !hasCoarse) {
            requestPermissionLauncher.launch(
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
            )
            isLoading = false
        } else {
            try {
                fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
                    .addOnSuccessListener { location: Location? ->
                        if (location != null) {
                            coroutineScope.launch {
                                try {
                                    val apiService = RetrofitClient.getInstance(context).apiService
                                    val now = Instant.now().toString()
                                    val payload = mapOf(
                                        "tipo_incidencia" to "Emergencia",
                                        "descripcion" to "Botón de pánico presionado desde aplicación nativa Android.",
                                        "latitud" to location.latitude,
                                        "longitud" to location.longitude,
                                        "fecha_suceso" to now
                                    )
                                    val response = apiService.crearAlertaJson(payload)
                                    if (response.isSuccessful) {
                                        feedbackType = "success"
                                        feedbackMsg = "¡ALERTA DE EMERGENCIA ENVIADA!\nEl Centro de Operaciones ha recibido tus coordenadas GPS y Serenazgo está atendiendo tu reporte."
                                        refreshHistory()
                                        
                                        // Auto-clear success message after 10s
                                        delay(10000)
                                        if (feedbackMsg != null && feedbackType == "success") {
                                            feedbackMsg = null
                                        }
                                    } else {
                                        feedbackType = "error"
                                        feedbackMsg = "Error en el servidor: ${response.code()}"
                                    }
                                } catch (e: Exception) {
                                    feedbackType = "error"
                                    feedbackMsg = "No se pudo transmitir la alerta al servidor central. Revise su conexión."
                                } finally {
                                    isLoading = false
                                }
                            }
                        } else {
                            isLoading = false
                            feedbackType = "error"
                            feedbackMsg = "No se pudo obtener la ubicación GPS actual. Verifique que el GPS esté encendido."
                        }
                    }
                    .addOnFailureListener { e ->
                        isLoading = false
                        feedbackType = "error"
                        feedbackMsg = "Fallo al capturar GPS: ${e.message}"
                    }
            } catch (e: SecurityException) {
                isLoading = false
                feedbackType = "error"
                feedbackMsg = "Permisos de GPS revocados."
            }
        }
    }

    // Infinite pulse animations for panic button waves
    val infiniteTransition = rememberInfiniteTransition(label = "pulseWaves")
    
    val scalePulse1 by infiniteTransition.animateFloat(
        initialValue = 1.0f,
        targetValue = 1.35f,
        animationSpec = infiniteRepeatable(
            animation = tween(1600, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "scalePulse1"
    )
    val alphaPulse1 by infiniteTransition.animateFloat(
        initialValue = 0.75f,
        targetValue = 0.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(1600, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "alphaPulse1"
    )

    val scalePulse2 by infiniteTransition.animateFloat(
        initialValue = 1.0f,
        targetValue = 1.5f,
        animationSpec = infiniteRepeatable(
            animation = tween(2200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "scalePulse2"
    )
    val alphaPulse2 by infiniteTransition.animateFloat(
        initialValue = 0.4f,
        targetValue = 0.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(2200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "alphaPulse2"
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        
        // Feedback message
        if (feedbackMsg != null) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 24.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (feedbackType == "success") Color(0x1A22C55E) else Color(0x1AEF4444)
                ),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(
                    width = 1.dp,
                    color = if (feedbackType == "success") Color(0x4D22C55E) else Color(0x4DEF4444)
                )
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = if (feedbackType == "success") Icons.Default.Info else Icons.Default.Warning,
                        contentDescription = "Status",
                        tint = if (feedbackType == "success") Color(0xFF86EFAC) else Color(0xFFFCA5A5),
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            text = if (feedbackType == "success") "¡ALERTA ENVIADA!" else "Hubo un problema",
                            color = if (feedbackType == "success") Color(0xFF86EFAC) else Color(0xFFFCA5A5),
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = feedbackMsg!!,
                            color = Slate100,
                            fontSize = 11.sp,
                            lineHeight = 15.sp
                        )
                    }
                }
            }
        }

        // Pulse and Panic Button
        Box(
            modifier = Modifier
                .size(260.dp),
            contentAlignment = Alignment.Center
        ) {
            // Pulse Waves
            if (!isLoading) {
                Box(
                    modifier = Modifier
                        .size(170.dp)
                        .scale(scalePulse1)
                        .alpha(alphaPulse1)
                        .background(Color(0x33EF4444), shape = CircleShape)
                )
                Box(
                    modifier = Modifier
                        .size(170.dp)
                        .scale(scalePulse2)
                        .alpha(alphaPulse2)
                        .background(PrimaryPastel.copy(alpha = 0.15f), shape = CircleShape)
                )
            }

            // Big Red Button
            Card(
                onClick = {
                    if (!isLoading) {
                        triggerPanicAlert()
                    }
                },
                modifier = Modifier
                    .size(164.dp),
                shape = CircleShape,
                colors = CardDefaults.cardColors(containerColor = Color(0xFFDC2626)),
                border = BorderStroke(6.dp, BgDark),
                elevation = CardDefaults.cardElevation(defaultElevation = 20.dp)
            ) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    if (isLoading) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(36.dp))
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "ENVIANDO...",
                                color = Color.White,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp
                            )
                        }
                    } else {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Text("🚨", fontSize = 34.sp)
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "PÁNICO",
                                color = Color.White,
                                fontSize = 22.sp,
                                fontWeight = FontWeight.Black,
                                letterSpacing = 1.5.sp
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
        
        Text(
            text = "Presiona el botón rojo en caso de emergencias graves que requieran atención inmediata de serenazgo.",
            fontSize = 11.sp,
            color = Slate400,
            lineHeight = 15.sp,
            modifier = Modifier.padding(horizontal = 24.dp)
        )

        Spacer(modifier = Modifier.height(32.dp))

        // Secondary Button Card
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .border(BorderStroke(1.dp, BorderDark), shape = RoundedCornerShape(16.dp)),
            colors = CardDefaults.cardColors(containerColor = CardDark),
            shape = RoundedCornerShape(16.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("¿Deseas reportar otra incidencia?", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    Text("Robos, accidentes o vandalismo", color = Slate400, fontSize = 11.sp)
                }
                Button(
                    onClick = onNavigateToDetailedReport,
                    colors = ButtonDefaults.buttonColors(containerColor = Primary.copy(alpha = 0.15f)),
                    border = BorderStroke(1.dp, Primary.copy(alpha = 0.3f)),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Registrar", color = PrimaryPastel, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
fun HistoryTab(
    alertsList: List<Alert>,
    isLoading: Boolean,
    serverUrl: String,
    onRefresh: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize()) {
        // Tab Header actions
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text("Historial de Reportes", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                Text("Seguimiento de alertas en tiempo real", color = Slate400, fontSize = 11.sp)
            }
            IconButton(
                onClick = onRefresh,
                modifier = Modifier.background(CardDark, CircleShape).size(36.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Refresh,
                    contentDescription = "Recargar",
                    tint = Slate300,
                    modifier = Modifier.size(18.dp)
                )
            }
        }

        if (isLoading && alertsList.isEmpty()) {
            Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = PrimaryPastel)
            }
        } else if (alertsList.isEmpty()) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                    Icon(
                        imageVector = Icons.Default.List,
                        contentDescription = "Empty",
                        tint = Slate500,
                        modifier = Modifier.size(48.dp)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("No has realizado reportes aún", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    Text("Tus alertas emitidas aparecerán aquí.", color = Slate400, fontSize = 11.sp)
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = PaddingValues(bottom = 16.dp)
            ) {
                items(alertsList) { alert ->
                    AlertItem(alert = alert, serverUrl = serverUrl)
                }
            }
        }
    }
}

@Composable
fun AlertItem(alert: Alert, serverUrl: String) {
    // Format timestamp
    val formattedDate = remember(alert.fechaSuceso) {
        try {
            val instant = Instant.parse(alert.fechaSuceso)
            val formatter = DateTimeFormatter.ofPattern("dd 'de' MMM, hh:mm a", Locale("es", "PE"))
            instant.atZone(ZoneId.of("America/Lima")).format(formatter)
        } catch (e: Exception) {
            alert.fechaSuceso
        }
    }

    val statusColor = when (alert.estado) {
        "Atendido" -> Color(0xFF22C55E)
        "En camino" -> PrimaryPastel
        "Falsa Alarma" -> Slate400
        "Cancelado" -> Color(0xFFEF4444)
        else -> Color(0xFFF59E0B) // Pendiente
    }

    val statusBg = statusColor.copy(alpha = 0.15f)

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = CardDark),
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(0.5.dp, BorderDark)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header: Type & Status
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .background(
                                color = if (alert.tipoIncidencia == "Emergencia") Color(0x33EF4444) else Primary.copy(alpha = 0.2f),
                                shape = RoundedCornerShape(6.dp)
                            )
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text(
                            text = alert.tipoIncidencia,
                            color = if (alert.tipoIncidencia == "Emergencia") Color(0xFFFCA5A5) else PrimaryPastel,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "#${alert.id}",
                        color = Slate500,
                        fontSize = 9.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }

                Box(
                    modifier = Modifier
                        .background(color = statusBg, shape = RoundedCornerShape(50.dp))
                        .border(1.dp, statusColor.copy(alpha = 0.3f), shape = RoundedCornerShape(50.dp))
                        .padding(horizontal = 8.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = alert.estado,
                        color = statusColor,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Body: Date & Description
            Text(
                text = "Fecha: $formattedDate",
                color = Slate300,
                fontSize = 11.sp
            )

            if (!alert.descripcion.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(6.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(BgDark.copy(alpha = 0.4f), shape = RoundedCornerShape(8.dp))
                        .padding(8.dp)
                ) {
                    Text(
                        text = alert.descripcion,
                        color = Slate100,
                        fontSize = 11.sp,
                        lineHeight = 14.sp
                    )
                }
            }

            // Evidence image
            if (!alert.evidenciaUrl.isNullOrBlank()) {
                val fullImgUrl = if (alert.evidenciaUrl.startsWith("http")) alert.evidenciaUrl else "$serverUrl${alert.evidenciaUrl}"
                Spacer(modifier = Modifier.height(10.dp))
                AsyncImage(
                    model = fullImgUrl,
                    contentDescription = "Evidencia fotográfica",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(120.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .border(0.5.dp, BorderDark, RoundedCornerShape(8.dp))
                )
            }
        }
    }
}
