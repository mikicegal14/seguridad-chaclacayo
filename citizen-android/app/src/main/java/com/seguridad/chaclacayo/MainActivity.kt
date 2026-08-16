package com.seguridad.chaclacayo

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.*
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.seguridad.chaclacayo.data.api.SocketManager
import com.seguridad.chaclacayo.data.local.PrefsManager
import com.seguridad.chaclacayo.ui.screens.DashboardScreen
import com.seguridad.chaclacayo.ui.screens.LoginScreen
import com.seguridad.chaclacayo.ui.screens.RegisterScreen
import com.seguridad.chaclacayo.ui.screens.ReportFormScreen
import com.seguridad.chaclacayo.ui.theme.ChaclacayoAlertaTheme

class MainActivity : ComponentActivity() {

    private lateinit var prefsManager: PrefsManager

    // Proactively request GPS and Notification permissions on startup (matching PWA behavior)
    private val requestPermissionsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineLocation = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        val coarseLocation = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] ?: false
        if (fineLocation || coarseLocation) {
            Toast.makeText(this, "Permisos de ubicación habilitados.", Toast.LENGTH_SHORT).show()
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val notifications = permissions[Manifest.permission.POST_NOTIFICATIONS] ?: false
            if (!notifications) {
                Toast.makeText(this, "Permiso de notificaciones necesario para alertas en segundo plano.", Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefsManager = PrefsManager(this)

        // Trigger permissions request on start
        val permissionsToRequest = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissionsToRequest.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        requestPermissionsLauncher.launch(permissionsToRequest.toTypedArray())

        setContent {
            ChaclacayoAlertaTheme {
                val navController = rememberNavController()
                val startDestination = if (prefsManager.isLoggedIn) "dashboard" else "login"

                NavHost(navController = navController, startDestination = startDestination) {
                    composable("login") {
                        LoginScreen(
                            prefsManager = prefsManager,
                            onLoginSuccess = {
                                navController.navigate("dashboard") {
                                    popUpTo("login") { inclusive = true }
                                }
                            },
                            onNavigateToRegister = {
                                navController.navigate("register")
                            }
                        )
                    }

                    composable("register") {
                        RegisterScreen(
                            prefsManager = prefsManager,
                            onRegisterSuccess = {
                                navController.navigate("dashboard") {
                                    popUpTo("register") { inclusive = true }
                                    popUpTo("login") { inclusive = true }
                                }
                            },
                            onNavigateToLogin = {
                                navController.navigate("login") {
                                    popUpTo("register") { inclusive = true }
                                }
                            }
                        )
                    }

                    composable("dashboard") {
                        DashboardScreen(
                            prefsManager = prefsManager,
                            onLogout = {
                                prefsManager.clear()
                                SocketManager.getInstance(applicationContext).disconnect()
                                navController.navigate("login") {
                                    popUpTo("dashboard") { inclusive = true }
                                }
                            },
                            onNavigateToDetailedReport = {
                                navController.navigate("report_form")
                            }
                        )
                    }

                    composable("report_form") {
                        ReportFormScreen(
                            onNavigateBack = {
                                navController.popBackStack()
                            },
                            onReportSubmitted = {
                                navController.popBackStack()
                            }
                        )
                    }
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        // Disconnect WebSockets if application is closed
        SocketManager.getInstance(this).disconnect()
    }
}
