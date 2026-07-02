package com.openwhispr.ime

import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * Minimal client for the desktop LAN bridge (scripts/mobile-whisper-server.js).
 * Platform HttpURLConnection only — no OkHttp, no coroutines dependency.
 */
object BridgeClient {

    fun transcribe(serverUrl: String, token: String?, language: String?, wav: ByteArray): String {
        val base = serverUrl.trimEnd('/')
        // clean=1: the bridge runs the shared offline cleanup rules server-side
        var query = "?clean=1"
        if (!language.isNullOrBlank() && language != "auto") {
            query += "&lang=" + URLEncoder.encode(language, "UTF-8")
        }
        val conn = URL("$base/transcribe$query").openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "POST"
            conn.doOutput = true
            conn.connectTimeout = 5000
            conn.readTimeout = 120000
            conn.setRequestProperty("Content-Type", "audio/wav")
            if (!token.isNullOrBlank()) conn.setRequestProperty("X-Token", token)
            conn.setFixedLengthStreamingMode(wav.size)
            conn.outputStream.use { it.write(wav) }

            val status = conn.responseCode
            val body = (if (status in 200..299) conn.inputStream else conn.errorStream)
                ?.bufferedReader()?.readText() ?: ""
            if (status != 200) throw IOException("Bridge HTTP $status: ${body.take(200)}")
            return JSONObject(body).optString("text").trim()
        } finally {
            conn.disconnect()
        }
    }
}
