import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import agentOrchestrator from './services/agentOrchestrator.js';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const res = await agentOrchestrator.handleQuery({
      query: "My neighbor built a fence on my property.",
      mode: "lawyer",
      user: { role: 'lawyer', domain: 'civil' },
      history: [],
      language: "en"
    });
    console.log("Success:", res.status);
    console.log("Conflicts array?", Array.isArray(res.review?.conflicts));
  } catch (err) {
    console.error("Error generating lawyer query:", err);
  }
  process.exit(0);
}
run();
