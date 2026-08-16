package com.seguridad.chaclacayo.widget

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.util.Log
import android.widget.Toast
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.*
import com.seguridad.chaclacayo.R
import com.seguridad.chaclacayo.data.api.RetrofitClient
import com.seguridad.chaclacayo.data.local.PrefsManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Instant

class PanicWidgetService : Service() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private val serviceScope = CoroutineScope(Dispatchers.IO)

    companion object {
        private const val TAG = "PanicWidgetService"
        private const val CHANNEL_ID = "PanicWidgetServiceChannel"
        private const val NOTIFICATION_ID = 911
    }

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "Starting PanicWidgetService foreground process")
        
        // Start Foreground immediately to satisfy Android background service constraints
        startForeground(NOTIFICATION_ID, createNotification("Iniciando envío de emergencia...", true))

        // Check GPS permissions
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
            ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED
        ) {
            updateNotification("Error: Sin permisos de GPS. Ábralo en la app para activarlo.")
            Toast.makeText(this, "Permiso de GPS denegado. Active la localización.", Toast.LENGTH_LONG).show()
            stopSelf()
            return START_NOT_STICKY
        }

        // Fetch location
        requestSingleLocation()

        return START_NOT_STICKY
    }

    private fun requestSingleLocation() {
        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5000)
            .setMaxUpdates(1)
            .build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                val location = locationResult.lastLocation
                if (location != null) {
                    Log.d(TAG, "Location acquired: Lat=${location.latitude}, Lng=${location.longitude}")
                    sendPanicAlert(location)
                } else {
                    Log.e(TAG, "Location is null")
                    fallbackToLastLocation()
                }
            }

            override fun onLocationAvailability(locationAvailability: LocationAvailability) {
                if (!locationAvailability.isLocationAvailable) {
                    Log.w(TAG, "Location unavailable, attempting last known location")
                    fallbackToLastLocation()
                }
            }
        }

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
        } catch (unlikely: SecurityException) {
            Log.e(TAG, "Lost location permission: $unlikely")
            updateNotification("Error: Sin permiso de GPS.")
            stopSelf()
        }
    }

    private fun fallbackToLastLocation() {
        try {
            fusedLocationClient.lastLocation.addOnSuccessListener { location ->
                if (location != null) {
                    Log.d(TAG, "Fallback location acquired: Lat=${location.latitude}, Lng=${location.longitude}")
                    sendPanicAlert(location)
                } else {
                    Log.e(TAG, "Fallback location also null")
                    updateNotification("Error de GPS: Asegúrese de encender la ubicación.")
                    stopSelf()
                }
            }
        } catch (unlikely: SecurityException) {
            updateNotification("Error: Sin permiso de GPS.")
            stopSelf()
        }
    }

    private fun sendPanicAlert(location: Location) {
        updateNotification("Transmitiendo alerta de pánico a Serenazgo...")

        val apiService = RetrofitClient.getInstance(this).apiService
        val nowIso = Instant.now().toString()

        val payload = mapOf(
            "tipo_incidencia" to "Emergencia",
            "descripcion" to "Botón de pánico presionado desde widget de pantalla de inicio.",
            "latitud" to location.latitude,
            "longitud" to location.longitude,
            "fecha_suceso" to nowIso
        )

        serviceScope.launch {
            try {
                val response = apiService.crearAlertaJson(payload)
                if (response.isSuccessful) {
                    Log.d(TAG, "Panic alert successfully sent via Widget!")
                    launch(Dispatchers.Main) {
                        Toast.makeText(applicationContext, "¡ALERTA DE EMERGENCIA ENVIADA!", Toast.LENGTH_LONG).show()
                    }
                    updateNotification("¡Alerta de emergencia enviada con éxito!")
                } else {
                    val errorMsg = response.errorBody()?.string() ?: "Error de red"
                    Log.e(TAG, "Failed to send panic alert. Code: ${response.code()}, Body: $errorMsg")
                    updateNotification("Error al enviar alerta: ${response.code()}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Exception sending panic alert from widget", e)
                updateNotification("Error de conexión con el servidor.")
            } finally {
                // Remove callbacks and stop the service after a delay to show status
                fusedLocationClient.removeLocationUpdates(locationCallback)
                Thread.sleep(3000)
                stopSelf()
            }
        }
    }

    private fun createNotification(content: String, showProgress: Boolean = false): Notification {
        val intent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntentFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            android.app.PendingIntent.FLAG_IMMUTABLE
        } else {
            0
        }
        val pendingIntent = android.app.PendingIntent.getActivity(this, 0, intent, pendingIntentFlag)

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("Seguridad Chaclacayo")
            .setContentText(content)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)

        if (showProgress) {
            builder.setProgress(0, 0, true)
        }

        return builder.build()
    }

    private fun updateNotification(content: String) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID, createNotification(content, false))
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "Canal de Alertas de Emergencia Widget",
                NotificationManager.IMPORTANCE_HIGH
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(serviceChannel)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
