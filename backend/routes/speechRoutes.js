import express from "express";
import {
  textToSpeech,
  transcribeSpeech,
} from "../controllers/speechController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.post("/transcribe", transcribeSpeech);
router.post("/synthesize", textToSpeech);

export default router;
