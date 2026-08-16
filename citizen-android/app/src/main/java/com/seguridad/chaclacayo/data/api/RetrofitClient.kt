package com.seguridad.chaclacayo.data.api

import android.content.Context
import com.seguridad.chaclacayo.data.local.PrefsManager
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

class RetrofitClient private constructor(context: Context) {
    private val prefsManager = PrefsManager(context)
    private var currentUrl: String = prefsManager.serverUrl
    private var cachedService: ApiService? = null

    companion object {
        @Volatile
        private var instance: RetrofitClient? = null

        fun getInstance(context: Context): RetrofitClient {
            return instance ?: synchronized(this) {
                instance ?: RetrofitClient(context.applicationContext).also { instance = it }
            }
        }
    }

    val apiService: ApiService
        get() {
            val serverUrl = prefsManager.serverUrl
            if (cachedService == null || currentUrl != serverUrl) {
                currentUrl = serverUrl
                cachedService = buildRetrofit(serverUrl).create(ApiService::class.java)
            }
            return cachedService!!
        }

    private fun buildRetrofit(baseUrl: String): Retrofit {
        // Logging Interceptor
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

        // OkHttpClient with JWT Authorization Interceptor
        val client = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .addInterceptor(logging)
            .addInterceptor { chain ->
                val requestBuilder = chain.request().newBuilder()
                val token = prefsManager.token
                if (!token.isNullOrEmpty()) {
                    requestBuilder.addHeader("Authorization", "Bearer $token")
                }
                chain.proceed(requestBuilder.build())
            }
            .build()

        // Append ending slash if missing (Retrofit requirement)
        val formattedUrl = if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/"

        return Retrofit.Builder()
            .baseUrl(formattedUrl)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }
}
