import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(backendRoot, ".env") });

export const PORT = Number(process.env.PORT || 5000);
export const GEMINI_EMBEDDING_MODEL = "models/gemini-embedding-001";
export const EMBEDDING_DIMENSION = 768;

function normalizeEnvModel(value, fallback) {
  const raw = (value || fallback).trim();
  return raw
    .replace(/^['"]+/, "")
    .replace(/['"]+$/, "")
    .replace(/;+\s*$/, "");
}

export const GROQ_MODEL = normalizeEnvModel(
  process.env.GROQ_MODEL,
  "llama-3.1-8b-instant",
);
export const GEMINI_TRANSCRIPTION_MODEL =
  normalizeEnvModel(
    process.env.GEMINI_TRANSCRIPTION_MODEL,
    "models/gemini-2.5-flash",
  );
export const GEMINI_TTS_MODEL =
  normalizeEnvModel(
    process.env.GEMINI_TTS_MODEL,
    "models/gemini-2.5-flash-preview-tts",
  );

export function validateEnvironment() {
  const requiredVars = [
    "GEMINI_API_KEY",
    "GROQ_API_KEY",
    "JWT_SECRET",
    "MONGODB_URI",
    "PINECONE_API_KEY",
    "PINECONE_INDEX_NAME",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ];
  const missingVars = requiredVars.filter((key) => !process.env[key]);

  if (missingVars.length > 0) {
    throw new Error(`Missing environment variables: ${missingVars.join(", ")}`);
  }
}
