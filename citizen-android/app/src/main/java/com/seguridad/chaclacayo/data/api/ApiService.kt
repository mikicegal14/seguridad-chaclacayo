package com.seguridad.chaclacayo.data.api

import com.seguridad.chaclacayo.data.model.Alert
import com.seguridad.chaclacayo.data.model.AuthResponse
import com.seguridad.chaclacayo.data.model.User
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    @POST("api/auth/login")
    suspend fun login(
        @Body request: Map<String, String>
    ): Response<AuthResponse>

    @POST("api/auth/register")
    suspend fun register(
        @Body request: Map<String, String>
    ): Response<AuthResponse>

    @GET("api/auth/me")
    suspend fun getMe(): Response<User>

    @GET("api/alertas/mis-reportes")
    suspend fun getMisReportes(): Response<List<Alert>>

    // For Panic Button (no image, simple json request)
    @POST("api/alertas")
    suspend fun crearAlertaJson(
        @Body request: Map<String, @JvmSuppressWildcards Any>
    ): Response<Alert>

    // For Detailed Incident Report (multipart/form-data)
    @Multipart
    @POST("api/alertas")
    suspend fun crearAlertaMultipart(
        @Part("tipo_incidencia") tipoIncidencia: RequestBody,
        @Part("descripcion") descripcion: RequestBody?,
        @Part("latitud") latitud: RequestBody,
        @Part("longitud") longitud: RequestBody,
        @Part("fecha_suceso") fechaSuceso: RequestBody,
        @Part evidencia: MultipartBody.Part?
    ): Response<Alert>
}
