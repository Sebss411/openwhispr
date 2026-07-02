// Client for the desktop LAN transcription bridge
// (scripts/mobile-whisper-server.js). Uploads the recorded file as a raw
// binary body; the bridge converts to 16kHz WAV and runs whisper locally.
import * as FileSystem from "expo-file-system/legacy";

export async function checkServer(serverUrl: string, token?: string): Promise<string | null> {
  try {
    const res = await fetch(`${normalize(serverUrl)}/health`, {
      headers: token ? { "X-Token": token } : undefined,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.ok ? String(data.model ?? "unknown") : null;
  } catch {
    return null;
  }
}

export async function transcribeFile(
  serverUrl: string,
  fileUri: string,
  language: string,
  token?: string
): Promise<string> {
  const lang = language && language !== "auto" ? `?lang=${encodeURIComponent(language)}` : "";
  const result = await FileSystem.uploadAsync(
    `${normalize(serverUrl)}/transcribe${lang}`,
    fileUri,
    {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        "Content-Type": "application/octet-stream",
        ...(token ? { "X-Token": token } : {}),
      },
    }
  );
  if (result.status !== 200) {
    throw new Error(`Server error ${result.status}: ${result.body?.slice(0, 200)}`);
  }
  const data = JSON.parse(result.body);
  return (data.text ?? "").trim();
}

function normalize(url: string): string {
  return url.replace(/\/+$/, "");
}
