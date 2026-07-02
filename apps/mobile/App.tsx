// OpenWhispr Mobile MVP — record, transcribe on your own computer over LAN,
// clean up with the shared offline pipeline, copy/share, local history.
// Requires the desktop bridge running: `npm run serve:mobile` in the repo root.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Share } from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import * as Clipboard from "expo-clipboard";
// Shared core (Metro alias -> packages/core -> src/services/localtext)
import { processTranscriptLocally } from "@openwhispr/core";

import { checkServer, transcribeFile } from "./src/lib/api";
import { addEntry, deleteEntry, listEntries, HistoryEntry } from "./src/lib/history";
import { DEFAULT_SETTINGS, loadSettings, MobileSettings, saveSettings } from "./src/lib/settings";

type Status = "idle" | "recording" | "transcribing" | "error";

export default function App() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [settings, setSettings] = useState<MobileSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [serverModel, setServerModel] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setHistory(listEntries());
    void AudioModule.requestRecordingPermissionsAsync();
    void setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
  }, []);

  useEffect(() => {
    if (!settings.transcriptionServerUrl) {
      setServerModel(null);
      return;
    }
    let cancelled = false;
    checkServer(settings.transcriptionServerUrl, settings.serverToken || undefined).then((model) => {
      if (!cancelled) setServerModel(model);
    });
    return () => {
      cancelled = true;
    };
  }, [settings.transcriptionServerUrl, settings.serverToken]);

  const updateSettings = useCallback((patch: Partial<MobileSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const toggleRecording = useCallback(async () => {
    setError("");
    if (status === "recording") {
      setStatus("transcribing");
      try {
        await recorder.stop();
        const uri = recorder.uri;
        if (!uri) throw new Error("No recording produced");
        const raw = await transcribeFile(
          settings.transcriptionServerUrl,
          uri,
          settings.preferredLanguage,
          settings.serverToken || undefined
        );
        if (!raw) throw new Error("Empty transcription — try speaking closer to the mic");
        let finalText = raw;
        let method = "none";
        if (settings.useCleanupModel) {
          const processed = await processTranscriptLocally(raw, {
            language: settings.preferredLanguage,
            dictionaryEntries: settings.customDictionary,
            allowOllama: false,
          });
          finalText = processed.text || raw;
          method = processed.command ? `local-rules+${processed.command}` : "local-rules";
        }
        setResult(finalText);
        await Clipboard.setStringAsync(finalText);
        if (settings.saveHistory) {
          addEntry(raw, settings.useCleanupModel ? finalText : null, method);
          setHistory(listEntries());
        }
        setStatus("idle");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      }
      return;
    }
    if (!settings.transcriptionServerUrl) {
      setShowSettings(true);
      setError("Set the transcription server URL first (run `npm run serve:mobile` on your computer).");
      return;
    }
    await recorder.prepareToRecordAsync();
    recorder.record();
    setStatus("recording");
  }, [status, recorder, settings]);

  const buttonLabel = useMemo(() => {
    if (status === "recording") return "■  Stop & transcribe";
    if (status === "transcribing") return "Transcribing…";
    return "●  Record";
  }, [status]);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <Text style={styles.title}>OpenWhispr</Text>
        <Pressable onPress={() => setShowSettings((v) => !v)}>
          <Text style={styles.link}>{showSettings ? "Done" : "Settings"}</Text>
        </Pressable>
      </View>

      {showSettings ? (
        <View style={styles.settings}>
          <Text style={styles.label}>Server URL (from `npm run serve:mobile`)</Text>
          <TextInput
            style={styles.input}
            placeholder="http://192.168.1.50:8380"
            autoCapitalize="none"
            autoCorrect={false}
            value={settings.transcriptionServerUrl}
            onChangeText={(v) => updateSettings({ transcriptionServerUrl: v.trim() })}
          />
          <Text style={styles.hint}>
            {serverModel ? `✓ connected (model: ${serverModel})` : "✗ not reachable"}
          </Text>
          <Text style={styles.label}>Token (only if the bridge uses --token)</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            value={settings.serverToken}
            onChangeText={(v) => updateSettings({ serverToken: v.trim() })}
          />
          <Text style={styles.label}>Language (auto, es, en, …)</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            value={settings.preferredLanguage}
            onChangeText={(v) => updateSettings({ preferredLanguage: v.trim() || "auto" })}
          />
          <View style={styles.switchRow}>
            <Text style={styles.label}>Cleanup (off = raw transcript)</Text>
            <Switch
              value={settings.useCleanupModel}
              onValueChange={(v) => updateSettings({ useCleanupModel: v })}
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.label}>Save history</Text>
            <Switch
              value={settings.saveHistory}
              onValueChange={(v) => updateSettings({ saveHistory: v })}
            />
          </View>
          <Text style={styles.label}>Dictionary (one per line; "misheard =&gt; correct")</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            multiline
            autoCapitalize="none"
            value={settings.customDictionary.join("\n")}
            onChangeText={(v) =>
              updateSettings({ customDictionary: v.split("\n").map((s) => s.trim()).filter(Boolean) })
            }
          />
        </View>
      ) : (
        <>
          <Pressable
            style={[styles.recordButton, status === "recording" && styles.recording]}
            onPress={toggleRecording}
            disabled={status === "transcribing"}
          >
            {status === "transcribing" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.recordLabel}>{buttonLabel}</Text>
            )}
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {result ? (
            <View style={styles.resultBox}>
              <Text style={styles.result}>{result}</Text>
              <View style={styles.actions}>
                <Pressable onPress={() => Clipboard.setStringAsync(result)}>
                  <Text style={styles.link}>Copy</Text>
                </Pressable>
                <Pressable onPress={() => Share.share({ message: result })}>
                  <Text style={styles.link}>Share</Text>
                </Pressable>
              </View>
              <Text style={styles.hint}>Copied to clipboard automatically</Text>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>History</Text>
          <FlatList
            data={history}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <Pressable
                style={styles.historyItem}
                onPress={() => Clipboard.setStringAsync(item.processed_text || item.original_text)}
                onLongPress={() => {
                  deleteEntry(item.id);
                  setHistory(listEntries());
                }}
              >
                <Text numberOfLines={2} style={styles.historyText}>
                  {item.processed_text || item.original_text}
                </Text>
                <Text style={styles.hint}>{item.timestamp} · tap to copy · hold to delete</Text>
              </Pressable>
            )}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, backgroundColor: "#fff" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 22, fontWeight: "700" },
  link: { color: "#2563eb", fontWeight: "600", padding: 4 },
  recordButton: {
    backgroundColor: "#111827",
    borderRadius: 16,
    paddingVertical: 28,
    alignItems: "center",
    marginVertical: 12,
  },
  recording: { backgroundColor: "#dc2626" },
  recordLabel: { color: "#fff", fontSize: 18, fontWeight: "700" },
  error: { color: "#dc2626", marginVertical: 8 },
  resultBox: { backgroundColor: "#f3f4f6", borderRadius: 12, padding: 12, marginVertical: 8 },
  result: { fontSize: 16, lineHeight: 22 },
  actions: { flexDirection: "row", gap: 16, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  historyItem: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#e5e7eb" },
  historyText: { fontSize: 14 },
  hint: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  settings: { gap: 4 },
  label: { fontSize: 13, fontWeight: "600", marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
});
