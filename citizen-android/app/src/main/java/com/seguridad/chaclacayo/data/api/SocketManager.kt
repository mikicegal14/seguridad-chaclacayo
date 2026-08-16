package com.seguridad.chaclacayo.data.api

import android.content.Context
import android.util.Log
import com.seguridad.chaclacayo.data.local.PrefsManager
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.net.URISyntaxException

class SocketManager private constructor(context: Context) {
    private val prefsManager = PrefsManager(context)
    private var socket: Socket? = null
    private val scope = CoroutineScope(Dispatchers.IO)

    private val _statusUpdates = MutableSharedFlow<Pair<Int, String>>()
    val statusUpdates: SharedFlow<Pair<Int, String>> = _statusUpdates

    companion object {
        private const val TAG = "SocketManager"

        @Volatile
        private var instance: SocketManager? = null

        fun getInstance(context: Context): SocketManager {
            return instance ?: synchronized(this) {
                instance ?: SocketManager(context.applicationContext).also { instance = it }
            }
        }
    }

    fun connect() {
        val serverUrl = prefsManager.serverUrl
        if (socket != null && socket!!.connected()) {
            return
        }

        try {
            val opts = IO.Options().apply {
                transports = arrayOf("websocket", "polling")
                forceNew = true
                reconnection = true
            }
            socket = IO.socket(serverUrl, opts)

            socket?.on(Socket.EVENT_CONNECT) {
                Log.d(TAG, "Socket.IO connected to $serverUrl")
                // Automatically join user room if logged in
                val currentUser = prefsManager.user
                if (currentUser != null) {
                    joinUserRoom(currentUser.id)
                }
            }

            socket?.on(Socket.EVENT_DISCONNECT) {
                Log.d(TAG, "Socket.IO disconnected")
            }

            socket?.on("alerta_estado_actualizado") { args ->
                if (args.isNotEmpty()) {
                    try {
                        val data = args[0] as JSONObject
                        val id = data.getInt("id")
                        val estado = data.getString("estado")
                        Log.d(TAG, "Alert status updated in real-time: ID=$id, Status=$estado")
                        scope.launch {
                            _statusUpdates.emit(Pair(id, estado))
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Error parsing status update from WebSocket", e)
                    }
                }
            }

            socket?.connect()
        } catch (e: URISyntaxException) {
            Log.e(TAG, "Failed to connect to socket: invalid URI", e)
        }
    }

    fun joinUserRoom(userId: Int) {
        socket?.let {
            if (it.connected()) {
                Log.d(TAG, "Emitting join_user event for user ID: $userId")
                it.emit("join_user", userId)
            }
        }
    }

    fun disconnect() {
        socket?.disconnect()
        socket = null
    }
}
