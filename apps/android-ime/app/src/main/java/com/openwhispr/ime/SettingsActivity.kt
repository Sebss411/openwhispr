package com.openwhispr.ime

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView

data class Prefs(val serverUrl: String, val token: String?, val language: String) {
    companion object {
        fun load(context: Context): Prefs {
            val p = context.getSharedPreferences("openwhispr", Context.MODE_PRIVATE)
            return Prefs(
                serverUrl = p.getString("serverUrl", "") ?: "",
                token = p.getString("token", null)?.ifBlank { null },
                language = p.getString("language", "auto") ?: "auto",
            )
        }
    }
}

/**
 * Minimal programmatic settings screen. Also the place where the
 * RECORD_AUDIO runtime permission is requested (an IME can't ask by itself)
 * and where the user enables the keyboard in system settings.
 */
class SettingsActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), 1)

        val prefs = getSharedPreferences("openwhispr", Context.MODE_PRIVATE)
        val pad = (16 * resources.displayMetrics.density).toInt()
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, pad, pad, pad)
        }

        fun label(text: String) = root.addView(TextView(this).apply { this.text = text })
        fun field(key: String, hint: String, default: String = ""): EditText {
            val e = EditText(this).apply {
                this.hint = hint
                setText(prefs.getString(key, default))
            }
            root.addView(e)
            return e
        }

        label(getString(R.string.settings_server))
        val server = field("serverUrl", "http://192.168.1.50:8380")
        label(getString(R.string.settings_token))
        val token = field("token", "(optional)")
        label(getString(R.string.settings_language))
        val language = field("language", "auto", "auto")

        root.addView(Button(this).apply {
            text = getString(R.string.settings_save)
            setOnClickListener {
                prefs.edit()
                    .putString("serverUrl", server.text.toString().trim())
                    .putString("token", token.text.toString().trim())
                    .putString("language", language.text.toString().trim().ifBlank { "auto" })
                    .apply()
                finish()
            }
        })
        root.addView(Button(this).apply {
            text = getString(R.string.settings_enable_ime)
            setOnClickListener { startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS)) }
        })

        setContentView(root)
    }
}
