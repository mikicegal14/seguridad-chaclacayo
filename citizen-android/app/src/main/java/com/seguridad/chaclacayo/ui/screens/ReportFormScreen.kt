package com.seguridad.chaclacayo.ui.screens

import android.Manifest
import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.net.Uri
import android.webkit.MimeTypeMap
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import coil.compose.AsyncImage
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.seguridad.chaclacayo.data.api.RetrofitClient
import com.seguridad.chaclacayo.ui.theme.*
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.util.Log
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReportFormScreen(
    onNavigateBack: () -> Unit,
    onReportSubmitted: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val apiService = RetrofitClient.getInstance(context).apiService

    // Form inputs state
    var tipoIncidencia by remember { mutableStateOf("Asalto") }
    var descripcion by remember { mutableStateOf("") }
    var selectedDateTime by remember { mutableStateOf(LocalDateTime.now()) }
    var imageUri by remember { mutableStateOf<Uri?>(null) }
    var cameraTempFile by remember { mutableStateOf<File?>(null) }
    
    var isLoading by remember { mutableStateOf(false) }
    var dropdownExpanded by remember { mutableStateOf(false) }

    val incidentTypes = listOf(
        "Asalto" to "Asalto / Robo",
        "Reporte" to "Reporte General / Sospechoso",
        "Accidente" to "Accidente de Tránsito",
        "Vandalismo" to "Vandalismo / Disturbio",
        "Otros" to "Otros"
    )

    // Launchers for image picking
    val galleryLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            imageUri = uri
        }
    }

    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture()
    ) { success ->
        if (success && cameraTempFile != null) {
            imageUri = Uri.fromFile(cameraTempFile)
        }
    }

    val requestCameraPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            val tempFile = createTempImageFile(context)
            cameraTempFile = tempFile
            val uri = FileProvider.getUriForFile(
                context,
                "com.seguridad.chaclacayo.fileprovider",
                tempFile
            )
            cameraLauncher.launch(uri)
        } else {
            Toast.makeText(context, "Permiso de cámara requerido para tomar fotos.", Toast.LENGTH_SHORT).show()
        }
    }

    // GPS location launcher
    val fusedLocationClient = remember { LocationServices.getFusedLocationProviderClient(context) }
    val requestGpsPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        val coarseGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] ?: false
        if (!fineGranted && !coarseGranted) {
            Toast.makeText(context, "Permiso de GPS obligatorio para enviar reportes.", Toast.LENGTH_LONG).show()
        }
    }

    // DateTime Picker dialogues
    val datePickerDialog = DatePickerDialog(
        context,
        { _, year, month, dayOfMonth ->
            selectedDateTime = selectedDateTime.withYear(year).withMonth(month + 1).withDayOfMonth(dayOfMonth)
            // Immediately open time picker after date is selected
            TimePickerDialog(
                context,
                { _, hourOfDay, minute ->
                    selectedDateTime = selectedDateTime.withHour(hourOfDay).withMinute(minute)
                },
                selectedDateTime.hour,
                selectedDateTime.minute,
                false
            ).show()
        },
        selectedDateTime.year,
        selectedDateTime.monthValue - 1,
        selectedDateTime.dayOfMonth
    )

    val onSubmitReport: () -> Unit = {
        val hasFine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val hasCoarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

        if (!hasFine && !hasCoarse) {
            requestGpsPermissionLauncher.launch(
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
            )
        } else {
            isLoading = true
            try {
                fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
                    .addOnSuccessListener { location: Location? ->
                        if (location != null) {
                            coroutineScope.launch {
                                try {
                                    // 1. Prepare RequestBodies
                                    val tipoPart = tipoIncidencia.toRequestBody("text/plain".toMediaTypeOrNull())
                                    val descPart = descripcion.toRequestBody("text/plain".toMediaTypeOrNull())
                                    val latPart = location.latitude.toString().toRequestBody("text/plain".toMediaTypeOrNull())
                                    val lngPart = location.longitude.toString().toRequestBody("text/plain".toMediaTypeOrNull())
                                    
                                    // Convert LocalDateTime to ISO string (local America/Lima equivalent or UTC)
                                    val localZone = ZoneId.of("America/Lima")
                                    val zonedDateTime = selectedDateTime.atZone(localZone)
                                    val isoDate = zonedDateTime.toInstant().toString()
                                    val datePart = isoDate.toRequestBody("text/plain".toMediaTypeOrNull())

                                    // 2. Prepare file part
                                    var filePart: MultipartBody.Part? = null
                                    if (imageUri != null) {
                                        val file = compressImage(context, imageUri!!)
                                        if (file != null) {
                                            val mimeType = "image/jpeg"
                                            val requestFile = file.asRequestBody(mimeType.toMediaTypeOrNull())
                                            filePart = MultipartBody.Part.createFormData("evidencia", file.name, requestFile)
                                        }
                                    }

                                    // 3. Make Api Call
                                    val response = apiService.crearAlertaMultipart(
                                        tipoIncidencia = tipoPart,
                                        descripcion = descPart,
                                        latitud = latPart,
                                        longitud = lngPart,
                                        fechaSuceso = datePart,
                                        evidencia = filePart
                                    )

                                    if (response.isSuccessful) {
                                        Toast.makeText(context, "¡Reporte registrado con éxito!", Toast.LENGTH_LONG).show()
                                        onReportSubmitted()
                                    } else {
                                        val errorMsg = response.errorBody()?.string() ?: "Error de servidor"
                                        Toast.makeText(context, "Fallo al enviar: $errorMsg", Toast.LENGTH_LONG).show()
                                    }
                                } catch (e: Exception) {
                                    Toast.makeText(context, "Error de red: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
                                } finally {
                                    isLoading = false
                                }
                            }
                        } else {
                            isLoading = false
                            Toast.makeText(context, "GPS apagado. Active la geolocalización.", Toast.LENGTH_LONG).show()
                        }
                    }
                    .addOnFailureListener { e ->
                        isLoading = false
                        Toast.makeText(context, "Error al obtener GPS: ${e.message}", Toast.LENGTH_LONG).show()
                    }
            } catch (_: SecurityException) {
                isLoading = false
                Toast.makeText(context, "Sin permisos de GPS.", Toast.LENGTH_SHORT).show()
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BgDark)
    ) {
        // Form Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(CardDark.copy(alpha = 0.6f))
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onNavigateBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Volver", tint = Color.White)
            }
            Spacer(modifier = Modifier.width(8.dp))
            Column {
                Text(
                    text = "Reportar Incidencia",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Text(
                    text = "Detalle el suceso con pruebas",
                    fontSize = 11.sp,
                    color = Slate400
                )
            }
        }

        // Scrollable Form content
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(20.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Type Dropdown Selector
            Column {
                Text("Tipo de Incidencia", color = Slate300, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(6.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(CardDark, RoundedCornerShape(12.dp))
                        .border(1.dp, BorderDark, RoundedCornerShape(12.dp))
                        .clickable { dropdownExpanded = true }
                        .padding(14.dp)
                ) {
                    val label = incidentTypes.firstOrNull { it.first == tipoIncidencia }?.second ?: tipoIncidencia
                    Text(text = label, color = Color.White, fontSize = 14.sp)
                    DropdownMenu(
                        expanded = dropdownExpanded,
                        onDismissRequest = { dropdownExpanded = false },
                        modifier = Modifier.fillMaxWidth(0.9f).background(CardDark)
                    ) {
                        incidentTypes.forEach { item ->
                            DropdownMenuItem(
                                text = { Text(item.second, color = Color.White) },
                                onClick = {
                                    tipoIncidencia = item.first
                                    dropdownExpanded = false
                                }
                            )
                        }
                    }
                }
            }

            // Date picker
            Column {
                Text("Fecha / Hora del Suceso", color = Slate300, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(6.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(CardDark, RoundedCornerShape(12.dp))
                        .border(1.dp, BorderDark, RoundedCornerShape(12.dp))
                        .clickable { datePickerDialog.show() }
                        .padding(14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val formatted = selectedDateTime.format(DateTimeFormatter.ofPattern("dd/MM/yyyy hh:mm a"))
                    Text(text = formatted, color = Color.White, fontSize = 14.sp)
                    Icon(Icons.Default.DateRange, contentDescription = "Elegir fecha", tint = PrimaryPastel)
                }
            }

            // Description
            Column {
                Text("Descripción", color = Slate300, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(6.dp))
                OutlinedTextField(
                    value = descripcion,
                    onValueChange = { descripcion = it },
                    placeholder = { Text("Detalles sobre el suceso (ej. vehículos, sospechosos, estado)", color = Slate500, fontSize = 13.sp) },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = PrimaryPastel,
                        unfocusedBorderColor = BorderDark,
                        focusedContainerColor = CardDark,
                        unfocusedContainerColor = CardDark
                    ),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(100.dp)
                )
            }

            // Evidence Photo Selector
            Column {
                Text("Evidencia Fotográfica", color = Slate300, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(6.dp))
                
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(160.dp)
                        .background(CardDark, RoundedCornerShape(12.dp))
                        .border(BorderStroke(1.dp, BorderDark), shape = RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    if (imageUri != null) {
                        Box(modifier = Modifier.fillMaxSize()) {
                            AsyncImage(
                                model = imageUri,
                                contentDescription = "Evidencia",
                                contentScale = ContentScale.Crop,
                                modifier = Modifier
                                    .fillMaxSize()
                                    .clip(RoundedCornerShape(12.dp))
                            )
                            // Remove photo button
                            IconButton(
                                onClick = { imageUri = null },
                                modifier = Modifier
                                    .align(Alignment.TopEnd)
                                    .padding(8.dp)
                                    .background(Color.Black.copy(alpha = 0.6f), CircleShape)
                                    .size(32.dp)
                            ) {
                                Icon(Icons.Default.Close, contentDescription = "Quitar foto", tint = Color.White, modifier = Modifier.size(16.dp))
                            }
                        }
                    } else {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Text("📸", fontSize = 28.sp)
                            Spacer(modifier = Modifier.height(4.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Button(
                                    onClick = {
                                        val hasCam = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                                        if (hasCam) {
                                            val tempFile = createTempImageFile(context)
                                            cameraTempFile = tempFile
                                            val uri = FileProvider.getUriForFile(context, "com.seguridad.chaclacayo.fileprovider", tempFile)
                                            cameraLauncher.launch(uri)
                                        } else {
                                            requestCameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                                        }
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = Primary.copy(alpha = 0.2f)),
                                    border = BorderStroke(1.dp, Primary.copy(alpha = 0.4f)),
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Text("Cámara", color = PrimaryPastel, fontSize = 11.sp)
                                }
                                Button(
                                    onClick = { galleryLauncher.launch("image/*") },
                                    colors = ButtonDefaults.buttonColors(containerColor = Secondary.copy(alpha = 0.2f)),
                                    border = BorderStroke(1.dp, Secondary.copy(alpha = 0.4f)),
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Text("Galería", color = SecondaryPastel, fontSize = 11.sp)
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Submit Button
            Button(
                onClick = onSubmitReport,
                enabled = !isLoading,
                colors = ButtonDefaults.buttonColors(containerColor = Primary),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
            ) {
                if (isLoading) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
                        Text("Enviando reporte con GPS...", fontSize = 14.sp)
                    }
                } else {
                    Text("Enviar Reporte con Ubicación GPS", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }
            }
        }
    }
}

// Helpers for Camera File creation and Uri copying
private fun createTempImageFile(context: Context): File {
    val dir = context.cacheDir
    return File.createTempFile("evidence_${System.currentTimeMillis()}", ".jpg", dir)
}

private fun compressImage(context: Context, uri: Uri): File? {
    try {
        val contentResolver = context.contentResolver
        
        // 1. First decode with inJustDecodeBounds=true to check dimensions
        val options = BitmapFactory.Options().apply {
            inJustDecodeBounds = true
        }
        var inputStream = contentResolver.openInputStream(uri)
        BitmapFactory.decodeStream(inputStream, null, options)
        inputStream?.close()

        val width = options.outWidth
        val height = options.outHeight
        Log.d("ImageCompress", "Original dimensions: $width x $height")

        // 2. Calculate inSampleSize to avoid OOM
        val maxDimension = 1280
        var inSampleSize = 1
        if (width > maxDimension || height > maxDimension) {
            val halfHeight = height / 2
            val halfWidth = width / 2
            while ((halfHeight / inSampleSize) >= maxDimension && (halfWidth / inSampleSize) >= maxDimension) {
                inSampleSize *= 2
            }
        }

        // 3. Decode bitmap with inSampleSize
        val decodeOptions = BitmapFactory.Options().apply {
            this.inSampleSize = inSampleSize
        }
        inputStream = contentResolver.openInputStream(uri)
        val bitmap = BitmapFactory.decodeStream(inputStream, null, decodeOptions)
        inputStream?.close()

        if (bitmap == null) return null

        // 4. Resize to maxDimension if still larger
        val scaledBitmap = if (bitmap.width > maxDimension || bitmap.height > maxDimension) {
            val ratio = bitmap.width.toFloat() / bitmap.height.toFloat()
            val newWidth: Int
            val newHeight: Int
            if (ratio > 1) {
                newWidth = maxDimension
                newHeight = (maxDimension / ratio).toInt()
            } else {
                newHeight = maxDimension
                newWidth = (maxDimension * ratio).toInt()
            }
            Bitmap.createScaledBitmap(bitmap, newWidth, newHeight, true)
        } else {
            bitmap
        }

        // 5. Correct orientation using EXIF data
        val rotation = getRotationAngle(context, uri)
        val rotatedBitmap = if (rotation != 0) {
            rotateBitmap(scaledBitmap, rotation)
        } else {
            scaledBitmap
        }

        // 6. Compress to a temp file in cache
        val compressedFile = File(context.cacheDir, "compressed_evidence_${System.currentTimeMillis()}.jpg")
        val outputStream = FileOutputStream(compressedFile)
        rotatedBitmap.compress(Bitmap.CompressFormat.JPEG, 80, outputStream)
        outputStream.flush()
        outputStream.close()

        // Clean up bitmaps
        if (rotatedBitmap != scaledBitmap && rotatedBitmap != bitmap) {
            rotatedBitmap.recycle()
        }
        if (scaledBitmap != bitmap) {
            scaledBitmap.recycle()
        }
        bitmap.recycle()

        Log.d("ImageCompress", "Compressed file size: ${compressedFile.length() / 1024} KB")
        return compressedFile
    } catch (e: Exception) {
        e.printStackTrace()
    }
    return null
}

private fun getRotationAngle(context: Context, uri: Uri): Int {
    var angle = 0
    try {
        context.contentResolver.openInputStream(uri)?.use { inputStream ->
            val exifInterface = ExifInterface(inputStream)
            val orientation = exifInterface.getAttributeInt(
                ExifInterface.TAG_ORIENTATION,
                ExifInterface.ORIENTATION_NORMAL
            )
            angle = when (orientation) {
                ExifInterface.ORIENTATION_ROTATE_90 -> 90
                ExifInterface.ORIENTATION_ROTATE_180 -> 180
                ExifInterface.ORIENTATION_ROTATE_270 -> 270
                else -> 0
            }
        }
    } catch (e: Exception) {
        e.printStackTrace()
    }
    return angle
}

private fun rotateBitmap(bitmap: Bitmap, angle: Int): Bitmap {
    val matrix = Matrix().apply { postRotate(angle.toFloat()) }
    return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
}
