package com.jotter.app

import android.content.Context
import android.os.Build
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class SyncClient(context: Context) {
    private val prefs = context.getSharedPreferences("sync", Context.MODE_PRIVATE)

    var serverBaseUrl: String
        get() = prefs.getString("server", null) ?: defaultBaseUrl()
        set(value) = prefs.edit().putString("server", value.trimEnd('/')).apply()

    private fun defaultBaseUrl(): String {
        return if (Build.TYPE == "user") "https://api.jotter.app/api"
        else "http://10.0.2.2:8000/api"
    }

    fun pushNote(note: Note): Boolean {
        val body = JSONObject()
            .put("entity_type", "note")
            .put("entity_id", note.id)
            .put("operation", if (note.syncStatus == "pending_delete") "delete" else "create")
            .put("payload", JSONObject()
                .put("note_type", note.type)
                .put("encrypted_title", note.title)
                .put("encrypted_payload", note.content)
                .put("source_url", note.sourceUrl)
                .put("is_pinned", note.isPinned)
                .put("is_archived", note.isArchived)
            )
        return post("$serverBaseUrl/sync/push", body)
    }

    private fun post(url: String, body: JSONObject): Boolean {
        return try {
            if (Build.TYPE == "user" && !url.startsWith("https://")) {
                android.util.Log.e("SyncClient", "Production build rejected non-HTTPS URL: $url")
                return false
            }
            val token = prefs.getString("access_token", null)
            val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                if (token != null) setRequestProperty("Authorization", "Bearer $token")
            }
            conn.outputStream.use { it.write(body.toString().toByteArray()) }
            conn.responseCode in 200..299
        } catch (_: Exception) {
            false
        }
    }
}
