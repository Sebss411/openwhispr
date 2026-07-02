package com.openwhispr.ime

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Records 16kHz mono 16-bit PCM with AudioRecord and packages it as a WAV
 * buffer — exactly what whisper-server wants, so the bridge's ffmpeg step is
 * effectively a pass-through. No third-party deps.
 */
class WavRecorder {
    companion object {
        const val SAMPLE_RATE = 16000
        private const val CHANNEL = AudioFormat.CHANNEL_IN_MONO
        private const val ENCODING = AudioFormat.ENCODING_PCM_16BIT
    }

    private var record: AudioRecord? = null
    private var thread: Thread? = null
    private val pcm = ByteArrayOutputStream()

    val isRecording: Boolean
        get() = record != null

    @SuppressLint("MissingPermission") // caller checks RECORD_AUDIO
    fun start() {
        if (record != null) return
        val minBuf = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL, ENCODING)
        if (minBuf <= 0) throw IOException("AudioRecord unsupported config")
        val r = AudioRecord(
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            SAMPLE_RATE, CHANNEL, ENCODING, minBuf * 4
        )
        if (r.state != AudioRecord.STATE_INITIALIZED) {
            r.release()
            throw IOException("Microphone unavailable (permission granted?)")
        }
        pcm.reset()
        r.startRecording()
        record = r
        thread = Thread {
            val buf = ByteArray(minBuf)
            while (record === r) {
                val n = r.read(buf, 0, buf.size)
                if (n > 0) synchronized(pcm) { pcm.write(buf, 0, n) }
            }
        }.also { it.start() }
    }

    /** Stops recording and returns the audio as a complete WAV file buffer. */
    fun stop(): ByteArray {
        val r = record ?: throw IOException("Not recording")
        record = null
        thread?.join(1000)
        thread = null
        try {
            r.stop()
        } catch (_: IllegalStateException) {
        }
        r.release()
        val data = synchronized(pcm) { pcm.toByteArray() }
        return wrapWav(data)
    }

    private fun wrapWav(pcmData: ByteArray): ByteArray {
        val byteRate = SAMPLE_RATE * 2 // mono 16-bit
        val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN)
        header.put("RIFF".toByteArray())
        header.putInt(36 + pcmData.size)
        header.put("WAVE".toByteArray())
        header.put("fmt ".toByteArray())
        header.putInt(16)             // PCM chunk size
        header.putShort(1)            // PCM format
        header.putShort(1)            // channels
        header.putInt(SAMPLE_RATE)
        header.putInt(byteRate)
        header.putShort(2)            // block align
        header.putShort(16)           // bits per sample
        header.put("data".toByteArray())
        header.putInt(pcmData.size)
        return header.array() + pcmData
    }
}
