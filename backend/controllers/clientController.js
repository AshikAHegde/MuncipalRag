import Client from '../models/Client.js';
import UserChat from '../models/UserChat.js';
import Document from '../models/Document.js';
import { extractTextFromPdfBuffer } from '../services/ragService.js';

export const getClients = async (req, res) => {
  try {
    const clients = await Client.find({ userId: req.user._id }).sort({ updatedAt: -1 });
    res.json({ success: true, clients });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch clients' });
  }
};

export const getClientById = async (req, res) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, userId: req.user._id });
    if (!client) return res.status(404).json({ success: false, error: 'Client not found' });
    
    res.json({ success: true, client });
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch client' });
  }
};

export const createClient = async (req, res) => {
  try {
    const { name, email, phone, caseDetails, notes } = req.body;
    
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' });

    const client = await Client.create({
      userId: req.user._id,
      name,
      email,
      phone,
      caseDetails,
      notes
    });

    res.status(201).json({ success: true, client });
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ success: false, error: 'Failed to create client' });
  }
};

export const updateClient = async (req, res) => {
  try {
    const { name, email, phone, caseDetails, notes } = req.body;
    
    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { name, email, phone, caseDetails, notes } },
      { new: true }
    );

    if (!client) return res.status(404).json({ success: false, error: 'Client not found' });
    
    res.json({ success: true, client });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ success: false, error: 'Failed to update client' });
  }
};

export const extractPdfText = async (req, res) => {
  try {
    const fileBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    
    if (!fileBuffer.length) {
      return res.status(400).json({ success: false, error: 'Please upload a PDF file.' });
    }

    const mimeType = req.headers['content-type'] || '';
    if (!mimeType.startsWith('application/pdf')) {
      return res.status(400).json({ success: false, error: 'Only PDF files are allowed.' });
    }

    const extractedText = await extractTextFromPdfBuffer(fileBuffer);
    
    res.json({ success: true, text: extractedText });
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to extract text from PDF.' });
  }
};
