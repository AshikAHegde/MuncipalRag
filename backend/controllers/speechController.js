import {
  synthesizeSpeech,
  transcribeAudio,
} from "../services/speechService.js";

const MAX_AUDIO_BASE64_CHARS = 15 * 1024 * 1024;

export async function transcribeSpeech(req, res) {
  try {
    const audioBase64 = req.body?.audioBase64?.trim();
    const mimeType = req.body?.mimeType?.trim() || "audio/webm";

    if (!audioBase64) {
      return res.status(400).json({
        success: false,
        error: "audioBase64 is required.",
      });
    }

    if (audioBase64.length > MAX_AUDIO_BASE64_CHARS) {
      return res.status(400).json({
        success: false,
        error: "Audio payload is too large.",
      });
    }

    const transcript = await transcribeAudio({ audioBase64, mimeType });
    return res.json({
      success: true,
      transcript,
    });
  } catch (error) {
    console.error("Transcribe speech failed:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to transcribe audio.",
    });
  }
}

export async function textToSpeech(req, res) {
  try {
    const text = req.body?.text?.trim();
    const voiceName = req.body?.voiceName?.trim() || "Kore";

    if (!text) {
      return res.status(400).json({
        success: false,
        error: "text is required.",
      });
    }

    const audio = await synthesizeSpeech({ text, voiceName });
    return res.json({
      success: true,
      ...audio,
    });
  } catch (error) {
    console.error("Text to speech failed:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to generate speech.",
    });
  }
}
