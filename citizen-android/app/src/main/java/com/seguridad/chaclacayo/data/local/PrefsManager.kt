package com.seguridad.chaclacayo.data.local

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson
import com.seguridad.chaclacayo.data.model.User

class PrefsManager(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("ChaclacayoAlertPrefs", Context.MODE_PRIVATE)
    private val gson = Gson()

    companion object {
        private const val KEY_TOKEN = "jwt_token"
        private const val KEY_USER = "user_profile"
        private const val KEY_SERVER_URL = "server_url"
        private const val DEFAULT_SERVER_URL = "http://10.0.2.2:3000"
    }

    var token: String?
        get() = prefs.getString(KEY_TOKEN, null)
        set(value) {
            prefs.edit().putString(KEY_TOKEN, value).apply()
        }

    var user: User?
        get() {
            val json = prefs.getString(KEY_USER, null) ?: return null
            return try {
                gson.fromJson(json, User::class.java)
            } catch (e: Exception) {
                null
            }
        }
        set(value) {
            val json = gson.toJson(value)
            prefs.edit().putString(KEY_USER, json).apply()
        }

    var serverUrl: String
        get() = prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL) ?: DEFAULT_SERVER_URL
        set(value) {
            var url = value.trim()
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
                url = "http://$url"
            }
            if (url.endsWith("/")) {
                url = url.substring(0, url.length - 1)
            }
            prefs.edit().putString(KEY_SERVER_URL, url).apply()
        }

    fun clear() {
        prefs.edit().remove(KEY_TOKEN).remove(KEY_USER).apply()
    }

    val isLoggedIn: Boolean
        get() = token != null && user != null
}
