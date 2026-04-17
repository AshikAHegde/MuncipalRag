import express from "express";
import {
  deleteUploadedDocument,
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
router.delete("/documents/:docId", deleteUploadedDocument);
router.post(
  "/upload",
  express.raw({
    type: "application/pdf",
    limit: "20mb",
  }),
  uploadDocument,
);
router.post("/process", processUploadedDocument);

export default router;
