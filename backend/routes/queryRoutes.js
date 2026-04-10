import express from "express";
import {
  exportComplianceReport,
  getUserChatHistory,
  queryKnowledgeBase,
} from "../controllers/queryController.js";
import { protect } from "../middleware/authMiddleware.js";
import { resolvePreferredLanguage } from "../middleware/languageMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(resolvePreferredLanguage);

router.get("/history", getUserChatHistory);
router.get("/export", exportComplianceReport);
router.post("/", queryKnowledgeBase);

export default router;
