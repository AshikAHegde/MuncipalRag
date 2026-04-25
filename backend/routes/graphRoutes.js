import express from 'express';
import { getSessionGraph, getProjectGraph, getMessageConflictGraph } from '../controllers/graphController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/project', protect, getProjectGraph);
router.get('/session/:sessionId', protect, getSessionGraph);
router.get('/message/:sessionId/:messageId', protect, getMessageConflictGraph);

export default router;
