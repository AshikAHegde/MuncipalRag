import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { 
  getClients, 
  getClientById, 
  createClient, 
  updateClient
} from '../controllers/clientController.js';

const router = express.Router();

router.use(protect); // All client routes require authentication

router.route('/')
  .get(getClients)
  .post(createClient);

router.route('/:id')
  .get(getClientById)
  .put(updateClient);

export default router;
