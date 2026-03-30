import express from "express";
import upload from "../config/upload.js";
import {
  downloadDocument,
  getUploadedDocuments,
  processUploadedDocument,
  uploadDocument,
} from "../controllers/adminController.js";
import { adminOnly, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect, adminOnly);

router.get("/documents", getUploadedDocuments);
router.get("/documents/:docId/download", downloadDocument);
router.post("/upload", upload.single("file"), uploadDocument);
router.post("/process", processUploadedDocument);

export default router;
