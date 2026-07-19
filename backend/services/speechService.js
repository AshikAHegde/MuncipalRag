import {
  GEMINI_TRANSCRIPTION_MODEL,
  GEMINI_TTS_MODEL,
} from "../config/appConfig.js";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

function assertGeminiKey() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
}

async function callGeminiGenerateContent(model, body) {
  assertGeminiKey();

  const response = await fetch(
    `${GEMINI_BASE_URL}/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  const data = await response.json();
  if (!response.ok) {
    const message =
      data?.error?.message || "Gemini API request failed for speech service.";
    throw new Error(message);
  }

  return data;
}

function extractTextFromGeminiResponse(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts
    .map((part) => part?.text || "")
    .join("\n")
    .trim();

  return text.replace(/^```(?:text)?\s*|\s*```$/g, "").trim();
}

function writeStringToBuffer(buffer, offset, value) {
  buffer.write(value, offset, "ascii");
}

function pcmToWavBuffer(pcmBuffer, sampleRate = 24000) {
  const channels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const wavBuffer = Buffer.alloc(44 + pcmBuffer.length);

  writeStringToBuffer(wavBuffer, 0, "RIFF");
  wavBuffer.writeUInt32LE(36 + pcmBuffer.length, 4);
  writeStringToBuffer(wavBuffer, 8, "WAVE");
  writeStringToBuffer(wavBuffer, 12, "fmt ");
  wavBuffer.writeUInt32LE(16, 16);
  wavBuffer.writeUInt16LE(1, 20);
  wavBuffer.writeUInt16LE(channels, 22);
  wavBuffer.writeUInt32LE(sampleRate, 24);
  wavBuffer.writeUInt32LE(byteRate, 28);
  wavBuffer.writeUInt16LE(blockAlign, 32);
  wavBuffer.writeUInt16LE(bitsPerSample, 34);
  writeStringToBuffer(wavBuffer, 36, "data");
  wavBuffer.writeUInt32LE(pcmBuffer.length, 40);
  pcmBuffer.copy(wavBuffer, 44);

  return wavBuffer;
}

export async function transcribeAudio({ audioBase64, mimeType }) {
  const response = await callGeminiGenerateContent(GEMINI_TRANSCRIPTION_MODEL, {
    contents: [
      {
        parts: [
          {
            text: "Transcribe this audio exactly. Return only the transcript text with no extra commentary.",
          },
          {
            inlineData: {
              mimeType,
              data: audioBase64,
            },
          },
        ],
      },
    ],
  });

  const transcript = extractTextFromGeminiResponse(response);
  if (!transcript) {
    throw new Error("No transcript was returned by the speech model.");
  }

  return transcript;
}

export async function synthesizeSpeech({ text, voiceName = "Kore" }) {
  const response = await callGeminiGenerateContent(GEMINI_TTS_MODEL, {
    contents: [
      {
        parts: [
          {
            text,
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName,
          },
        },
      },
    },
  });

  const audioPart = response?.candidates?.[0]?.content?.parts?.find(
    (part) => part?.inlineData?.data,
  );

  if (!audioPart?.inlineData?.data) {
    throw new Error("No audio data was returned by the TTS model.");
  }

  const pcmBuffer = Buffer.from(audioPart.inlineData.data, "base64");
  const wavBuffer = pcmToWavBuffer(pcmBuffer);

  return {
    audioBase64: wavBuffer.toString("base64"),
    mimeType: "audio/wav",
  };
}
