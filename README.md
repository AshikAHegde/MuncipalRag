# Municipal Rules RAG Application

A full-stack production-ready web application for navigating municipal corporation rules using Retrieval-Augmented Generation (RAG).

## Features
- **Modern Premium UI**: Clean design matching ChatGPT/Notion aesthetics, built with React and Tailwind CSS. Dark mode support and smooth animations.
- **RAG Architecture**: Uses OpenAI's latest embeddings (`text-embedding-3-small`) and `gpt-4o-mini` for accurate generation based on context.
- **Admin Interface**: Easy PDF upload for automatic extraction, chunking, embedding generation, and indexing into MongoDB Atlas Vector Search.
- **Robust Error Handling**: Graceful fallback states, comprehensive API error boundaries, and input validation.

## Prerequisites
- Node.js (v18+)
- MongoDB Atlas Account (with Vector Search enabled)
- OpenAI API Key

### Setting up MongoDB Vector Search
1. Create a cluster on MongoDB Atlas.
2. Under "Atlas Search", create a search index on your `documents` collection using the **JSON Editor**.
3. Use the following index definition:
```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    }
  ]
}
```

## Getting Started

### 1. Setup Backend
```bash
cd backend
npm install
```

Configure environment variables. Copy `.env.example` to `.env` (or update `.env` directly):
```
PORT=5000
MONGODB_URI=your_mongodb_atlas_connection_string
OPENAI_API_KEY=your_openai_api_key
JWT_SECRET=your_jwt_secret_key
```

Start the backend:
```bash
npm run dev # or node server.js
```

### 2. Setup Frontend
```bash
cd frontend
npm install
```

Start the frontend:
```bash
npm run dev
```

Visit `http://localhost:5173` to view the application.
# MuncipalRag
