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
export const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
export const UPLOAD_DIR = path.join(backendRoot, "uploads");

export function validateEnvironment() {
  const requiredVars = [
    "GEMINI_API_KEY",
    "GROQ_API_KEY",
    "JWT_SECRET",
    "MONGODB_URI",
    "PINECONE_API_KEY",
    "PINECONE_INDEX_NAME",
  ];
  const missingVars = requiredVars.filter((key) => !process.env[key]);

  if (missingVars.length > 0) {
    throw new Error(`Missing environment variables: ${missingVars.join(", ")}`);
  }
}
