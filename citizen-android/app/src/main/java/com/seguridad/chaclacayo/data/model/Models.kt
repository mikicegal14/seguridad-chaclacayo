package com.seguridad.chaclacayo.data.model

import com.google.gson.annotations.SerializedName

data class User(
    val id: Int,
    val dni: String,
    val nombre: String,
    val rol: String,
    @SerializedName("email_telefono") val emailTelefono: String?
)

data class AuthResponse(
    val token: String,
    val user: User
)

data class Alert(
    val id: Int,
    @SerializedName("user_id") val userId: Int,
    @SerializedName("tipo_incidencia") val tipoIncidencia: String,
    val descripcion: String?,
    val latitud: Double,
    val longitud: Double,
    @SerializedName("fecha_suceso") val fechaSuceso: String,
    @SerializedName("evidencia_url") val evidenciaUrl: String?,
    @SerializedName("fecha_ingreso") val fechaIngreso: String,
    val estado: String,
    @SerializedName("usuario_nombre") val usuarioNombre: String?,
    @SerializedName("usuario_dni") val usuarioDni: String?
)
