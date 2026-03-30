import fs from "fs/promises";
import multer from "multer";
import { randomUUID } from "crypto";
import { UPLOAD_DIR } from "./appConfig.js";

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const docId = randomUUID();
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    cb(null, `${docId}__${safeOriginalName}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === "application/pdf" ||
      file.originalname.toLowerCase().endsWith(".pdf")
    ) {
      cb(null, true);
      return;
    }

    cb(new Error("Only PDF files are allowed."));
  },
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

export default upload;
