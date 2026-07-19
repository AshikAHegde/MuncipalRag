import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { 
  getClients, 
  getClientById, 
  createClient, 
  updateClient,
  extractPdfText
} from '../controllers/clientController.js';

const router = express.Router();

router.use(protect);

router.post(
  '/extract-pdf',
  express.raw({
    type: 'application/pdf',
    limit: '20mb',
  }),
  extractPdfText
);

router.route('/')
  .get(getClients)
  .post(createClient);

router.route('/:id')
  .get(getClientById)
  .put(updateClient);

export default router;
