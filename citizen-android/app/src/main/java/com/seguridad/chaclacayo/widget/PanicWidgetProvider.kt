package com.seguridad.chaclacayo.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import android.widget.RemoteViews
import android.widget.Toast
import androidx.core.content.ContextCompat
import com.seguridad.chaclacayo.MainActivity
import com.seguridad.chaclacayo.R
import com.seguridad.chaclacayo.data.local.PrefsManager

class PanicWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val TAG = "PanicWidgetProvider"
        const val ACTION_PANIC_CLICK = "com.seguridad.chaclacayo.PANIC_CLICK"
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_PANIC_CLICK) {
            Log.d(TAG, "Panic button clicked on home screen widget")

            val prefs = PrefsManager(context)
            if (!prefs.isLoggedIn) {
                // User is not logged in, prompt them to open the app
                Toast.makeText(context, "Debe iniciar sesión en la aplicación primero.", Toast.LENGTH_LONG).show()
                val launchIntent = Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(launchIntent)
                return
            }

            // Start Foreground Service to fetch location and post alert
            val serviceIntent = Intent(context, PanicWidgetService::class.java)
            ContextCompat.startForegroundService(context, serviceIntent)
        }
    }

    private fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
        val views = RemoteViews(context.packageName, R.layout.widget_panic_layout)

        // Setup PendingIntent for circular button click
        val intent = Intent(context, PanicWidgetProvider::class.java).apply {
            action = ACTION_PANIC_CLICK
        }
        
        val flag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        val pendingIntent = PendingIntent.getBroadcast(context, 0, intent, flag)
        views.setOnClickPendingIntent(R.id.btn_widget_panic, pendingIntent)

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }
}
