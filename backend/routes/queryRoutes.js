import express from "express";
import {
  getUserChatHistory,
  queryKnowledgeBase,
} from "../controllers/queryController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/history", getUserChatHistory);
router.post("/", queryKnowledgeBase);

export default router;
