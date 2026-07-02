package com.openwhispr.ime

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Color
import android.inputmethodservice.InputMethodService
import android.view.Gravity
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import java.util.concurrent.Executors

/**
 * Voice keyboard: one big mic key. Tap to record, tap again to transcribe on
 * your own computer (LAN bridge) and type the result into whatever app has
 * focus — dictation anywhere, no cloud.
 *
 * Note: an IME cannot request runtime permissions itself; RECORD_AUDIO is
 * granted through SettingsActivity (launcher icon) first.
 */
class OpenWhisprImeService : InputMethodService() {

    private val recorder = WavRecorder()
    private val executor = Executors.newSingleThreadExecutor()
    private lateinit var status: TextView
    private lateinit var micButton: Button

    override fun onCreateInputView(): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#111827"))
            setPadding(24, 16, 24, 24)
        }

        status = TextView(this).apply {
            setTextColor(Color.parseColor("#9ca3af"))
            textSize = 13f
            gravity = Gravity.CENTER
            text = getString(R.string.status_idle)
        }

        micButton = Button(this).apply {
            text = getString(R.string.key_record)
            textSize = 18f
            setOnClickListener { toggleRecording() }
        }

        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val switchKey = Button(this).apply {
            text = "⌨"
            setOnClickListener {
                (getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager)
                    .showInputMethodPicker()
            }
        }
        val deleteKey = Button(this).apply {
            text = "⌫"
            setOnClickListener {
                currentInputConnection?.deleteSurroundingText(1, 0)
            }
        }
        row.addView(switchKey, LinearLayout.LayoutParams(0, WRAP, 1f))
        row.addView(micButton, LinearLayout.LayoutParams(0, WRAP, 3f))
        row.addView(deleteKey, LinearLayout.LayoutParams(0, WRAP, 1f))

        root.addView(status)
        root.addView(row)
        return root
    }

    private fun toggleRecording() {
        if (recorder.isRecording) {
            micButton.isEnabled = false
            status.text = getString(R.string.status_transcribing)
            val prefs = Prefs.load(this)
            executor.execute {
                val result = runCatching {
                    val wav = recorder.stop()
                    BridgeClient.transcribe(prefs.serverUrl, prefs.token, prefs.language, wav)
                }
                mainExecutor.execute {
                    micButton.isEnabled = true
                    micButton.text = getString(R.string.key_record)
                    result.fold(
                        onSuccess = { text ->
                            if (text.isBlank()) {
                                status.text = getString(R.string.status_empty)
                            } else {
                                currentInputConnection?.commitText(withSmartSpace(text), 1)
                                status.text = getString(R.string.status_idle)
                            }
                        },
                        onFailure = { e ->
                            status.text = (e.message ?: "error").take(80)
                        }
                    )
                }
            }
            return
        }

        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            status.text = getString(R.string.status_need_permission)
            return
        }
        val prefs = Prefs.load(this)
        if (prefs.serverUrl.isBlank()) {
            status.text = getString(R.string.status_need_server)
            return
        }
        runCatching { recorder.start() }.fold(
            onSuccess = {
                micButton.text = getString(R.string.key_stop)
                status.text = getString(R.string.status_recording)
            },
            onFailure = { e -> status.text = (e.message ?: "mic error").take(80) }
        )
    }

    /** Prepend a space when inserting after a word character, like desktop smart spacing. */
    private fun withSmartSpace(text: String): String {
        val before = currentInputConnection?.getTextBeforeCursor(1, 0)
        return if (!before.isNullOrEmpty() && !before.last().isWhitespace()) " $text" else text
    }

    override fun onDestroy() {
        if (recorder.isRecording) runCatching { recorder.stop() }
        executor.shutdown()
        super.onDestroy()
    }

    private companion object {
        const val WRAP = LinearLayout.LayoutParams.WRAP_CONTENT
    }
}
