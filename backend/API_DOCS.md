# Backend API Docs

Base URL:

```txt
http://localhost:5000
```

All responses are JSON unless noted otherwise.

## How to Run

To start the project in development mode:

### 1. Backend

Open a terminal and run:
```bash
cd backend
npm run dev
```
The backend will run on [http://localhost:5000](http://localhost:5000).

### 2. Frontend

Open a **separate** terminal and run:
```bash
cd frontend
npm run dev
```
The frontend will run on [http://localhost:3000](http://localhost:3000) (as configured in `vite.config.js`).

## Setup (Backend Install)

Use this if `npm i` fails on another machine due to dependency resolution issues:

```bash
cd backend
rm -rf node_modules package-lock.json
npm cache clean --force
npm install --legacy-peer-deps @google/generative-ai@0.24.1 @langchain/community@1.1.25 @langchain/core@1.1.36 @langchain/google-genai@2.1.26 @langchain/pinecone@1.0.1 @langchain/textsplitters@1.0.1 @pinecone-database/pinecone@7.1.0 axios@1.14.0 bcryptjs@3.0.3 cloudinary@2.9.0 cors@2.8.6 dotenv@17.3.1 express@5.2.1 jsonwebtoken@9.0.3 mongoose@9.3.3 pdf-parse@1.1.4 readline-sync@1.4.10
npm install -D nodemon@3.1.10
```

Recommended runtime:
- Node.js 20 LTS or 22 LTS

## Auth

### `POST /api/auth/register`

Create a new normal user.

Request body:

```json
{
  "fullName": "Ashik Hegde",
  "email": "ashik@example.com",
  "password": "secret123",
  "phone": "9876543210"
}
```

Notes:
- `fullName`, `email`, and `password` are required
- password must be at least 6 characters
- this route always creates `role: "user"`

Success response:

```json
{
  "success": true,
  "message": "User registered successfully.",
  "token": "jwt_token_here",
  "user": {
    "id": "680000000000000000000001",
    "fullName": "Ashik Hegde",
    "email": "ashik@example.com",
    "role": "user",
    "phone": "9876543210",
    "lastLoginAt": null,
    "createdAt": "2026-03-29T10:00:00.000Z",
    "updatedAt": "2026-03-29T10:00:00.000Z"
  }
}
```

Common errors:
- `400` missing fields
- `400` password too short
- `409` user already exists
- `500` server error

### `POST /api/auth/login`

Login an existing user.

Request body:

```json
{
  "email": "ashik@example.com",
  "password": "secret123"
}
```

Success response:

```json
{
  "success": true,
  "message": "Login successful.",
  "token": "jwt_token_here",
  "user": {
    "id": "680000000000000000000001",
    "fullName": "Ashik Hegde",
    "email": "ashik@example.com",
    "role": "user",
    "phone": "9876543210",
    "lastLoginAt": "2026-03-29T10:10:00.000Z",
    "createdAt": "2026-03-29T10:00:00.000Z",
    "updatedAt": "2026-03-29T10:10:00.000Z"
  }
}
```

Common errors:
- `400` missing email or password
- `401` invalid email or password
- `500` server error

### `GET /api/auth/me`

Get current logged-in user.

Headers:

```txt
Authorization: Bearer <jwt_token>
```

Success response:

```json
{
  "success": true,
  "user": {
    "id": "680000000000000000000001",
    "fullName": "Ashik Hegde",
    "email": "ashik@example.com",
    "role": "user",
    "phone": "9876543210",
    "lastLoginAt": "2026-03-29T10:10:00.000Z",
    "createdAt": "2026-03-29T10:00:00.000Z",
    "updatedAt": "2026-03-29T10:10:00.000Z"
  }
}
```

Common errors:
- `401` missing token
- `401` invalid or expired token

## Query

### `POST /api/query`

Ask a question to the RAG chatbot.

Request body:

```json
{
  "query": "What is the zoning rule for water supply?",
  "sessionId": "67f5c3d2f91d77f8a1a1b201",
  "history": [
    {
      "role": "user",
      "text": "Tell me about zoning."
    },
    {
      "role": "model",
      "text": "Here is a summary of zoning."
    }
  ]
}
```

Notes:
- `query` is required
- `sessionId` is optional and appends the new exchange to an existing chat session
- `history` is optional
- allowed history roles are `user` and `model`
- optional `mode` supports:
  - `chat` for normal question-answer flow
  - `compliance_review` for checking a long submission against indexed rules
- when `mode` is `compliance_review`, send `submission` instead of `query`

Success response:

```json
{
  "success": true,
  "mode": "chat",
  "answer": "The answer generated from the indexed PDF context.",
  "sources": [
    {
      "page": 4,
      "section": "Match 1",
      "text": "Relevant chunk text from the PDF.",
      "score": 0.91,
      "source": "sample.pdf"
    }
  ],
  "chatSession": {
    "id": "67f5c3d2f91d77f8a1a1b201",
    "title": "Chat 1",
    "mode": "chat",
    "createdAt": "2026-04-09T08:20:00.000Z",
    "lastAskedAt": "2026-04-09T08:24:00.000Z",
    "previewQuestion": "What is the zoning rule for water supply?",
    "previewAnswer": "The answer generated from the indexed PDF context.",
    "conversationCount": 2,
    "conversations": [
      {
        "id": "2026-04-09T08:24:00.000Z-0",
        "mode": "chat",
        "question": "What is the zoning rule for water supply?",
        "answer": "The answer generated from the indexed PDF context.",
        "sources": []
      }
    ]
  }
}
```

Common errors:
- `400` missing query
- `500` embedding, Pinecone, Groq, or server error

### `POST /api/query` with compliance review mode

Review a long user submission such as a tender, builder scope, checklist, or process note against the indexed rule documents.

Request body:

```json
{
  "mode": "compliance_review",
  "submission": "1. Builder must provide fire exit width of 1.5m\n2. Temporary power connection is optional\n3. Water tank capacity is 20000 litres",
  "sessionId": "67f5c3d2f91d77f8a1a1b201",
  "history": []
}
```

Success response:

```json
{
  "success": true,
  "mode": "compliance_review",
  "answer": "Overall compliance: 67%\nSummary: ...\n\nWhat is correct:\n- ...\n\nWhat is wrong or needs correction:\n- ...\n\nLine-by-line review:\n1. [CORRECT - 100%] ...",
  "review": {
    "overallPercentage": 67,
    "summary": "Short compliance summary.",
    "correctItems": ["Requirement 1 matches the rules."],
    "wrongItems": ["Requirement 2 is not allowed under the rules."],
    "lineReviews": [
      {
        "lineNumber": 1,
        "lineText": "Builder must provide fire exit width of 1.5m",
        "status": "correct",
        "percentage": 100,
        "explanation": "This matches the indexed fire safety rule.",
        "supportingRule": "Minimum fire exit width must be 1.5m.",
        "source": "fire_rules.pdf",
        "page": 8
      }
    ]
  },
  "sources": [
    {
      "page": 8,
      "section": "Match 1",
      "text": "Minimum fire exit width must be 1.5m.",
      "score": 0.94,
      "source": "fire_rules.pdf"
    }
  ]
}
```

Notes:
- best results come when the submission is written as separate lines or numbered points
- the API currently reviews up to the first 25 non-empty lines
- the response `answer` is already formatted as a plain text audit for direct chat display

### `GET /api/query/history`

Fetch the signed-in user's saved chat sessions.

Success response:

```json
{
  "success": true,
  "chatSessions": [
    {
      "id": "67f5c3d2f91d77f8a1a1b201",
      "title": "Chat 1",
      "mode": "chat",
      "createdAt": "2026-04-09T08:20:00.000Z",
      "lastAskedAt": "2026-04-09T08:24:00.000Z",
      "previewQuestion": "What is the zoning rule for water supply?",
      "previewAnswer": "The answer generated from the indexed PDF context.",
      "conversationCount": 2,
      "conversations": [
        {
          "id": "2026-04-09T08:24:00.000Z-0",
          "mode": "chat",
          "question": "What is the zoning rule for water supply?",
          "answer": "The answer generated from the indexed PDF context.",
          "sources": [],
          "askedAt": "2026-04-09T08:24:00.000Z"
        }
      ]
    }
  ],
  "chats": [
    {
      "id": "2026-04-09T08:24:00.000Z-0",
      "mode": "chat",
      "question": "What is the zoning rule for water supply?",
      "answer": "The answer generated from the indexed PDF context.",
      "sources": [],
      "askedAt": "2026-04-09T08:24:00.000Z",
      "sessionId": "67f5c3d2f91d77f8a1a1b201",
      "sessionTitle": "Chat 1"
    }
  ]
}
```

### `GET /api/query/export`

Export a compliance review record as an official audit report file.

Query params:
- `sessionId` (required): chat session id
- `messageId` (required): compliance message id within that session
- `format` (optional): `pdf` or `excel` (default `pdf`)

Example request:

```http
GET /api/query/export?sessionId=67f5c3d2f91d77f8a1a1b201&messageId=67f5c3d2f91d77f8a1a1b209&format=excel
Authorization: Bearer <token>
```

Success response:
- Returns downloadable file stream as attachment.
- `Content-Type` is `application/pdf` for PDF or XLSX mime type for Excel.

Common errors:
- `400` missing `sessionId` or `messageId`, or invalid format
- `404` session/message not found
- `422` message exists but has no structured review JSON
- `500` report generation failed

## Admin

Important note:
- the admin routes exist under `/api/admin`
- these routes are protected by `protect` and `adminOnly` middleware
- uploaded PDFs are stored in Cloudinary and tracked in MongoDB

### `GET /api/admin/documents`

List uploaded PDF files tracked in MongoDB.

Success response:

```json
{
  "success": true,
  "documents": [
    {
      "docId": "975c6d1b-1024-4e11-8067-7e4771c97101",
      "fileName": "m.pdf",
      "uploadedAt": "2026-03-29T09:30:00.000Z",
      "size": 240123
    }
  ]
}
```

Common errors:
- `500` could not fetch uploaded documents

### `GET /api/admin/documents/:docId/download`

Download a previously uploaded PDF.

Path param:
- `docId` is the generated file UUID

Success response:
- returns the PDF file as a download, not JSON

Common errors:
- `404` PDF not found
- `500` download failed

### `POST /api/admin/upload`

Upload a PDF file.

Content type:

```txt
application/pdf
```

Required header:
- `X-File-Name` with the original file name

Success response:

```json
{
  "success": true,
  "docId": "975c6d1b-1024-4e11-8067-7e4771c97101",
  "fileName": "m.pdf",
  "pages": 12,
  "message": "PDF uploaded successfully to cloud storage."
}
```

Common errors:
- `400` missing file body
- `400` non-PDF file
- `500` upload failed

### `POST /api/admin/process`

Read an uploaded PDF, chunk it, create embeddings, and store vectors in Pinecone.

Request body:

```json
{
  "docId": "975c6d1b-1024-4e11-8067-7e4771c97101"
}
```

Success response:

```json
{
  "success": true,
  "message": "Document processed successfully. 34 chunks stored in Pinecone.",
  "chunkCount": 34,
  "pageCount": 12
}
```

Common errors:
- `400` missing `docId`
- `404` uploaded PDF not found
- `500` PDF processing or embedding failed

### `DELETE /api/admin/documents/:docId`

Delete an uploaded PDF everywhere.

This removes:
- the PDF asset from Cloudinary
- the document chunks from Pinecone
- the `Document` record from MongoDB
- the document reference from the owning user's `documentIds` array

Path param:
- `docId` is the generated file UUID

Success response:

```json
{
  "success": true,
  "message": "Document deleted from Cloudinary, Pinecone, and MongoDB.",
  "docId": "975c6d1b-1024-4e11-8067-7e4771c97101"
}
```

Common errors:
- `400` missing `docId`
- `404` uploaded PDF not found
- `500` deletion failed

## Health

### `GET /api/health`

Simple health check endpoint.

Success response:

```json
{
  "success": true,
  "message": "Backend is running."
}
```

## Graph Knowledge

### `GET /api/graph/session/:sessionId`

Fetch the interactive relationship graph for an entire chat session.

Path Params:
- `sessionId`: The ID of the chat session

Success response:

```json
{
  "success": true,
  "graph": {
    "nodes": [
      { "id": "session-1", "type": "session", "label": "Session Title" },
      { "id": "conv-1", "type": "card", "label": "Question Preview..." },
      { "id": "sec-IPC-302", "type": "section", "label": "IPC 302" }
    ],
    "edges": [
      { "id": "e1", "source": "session-1", "target": "conv-1", "label": "CONTAINS" },
      { "id": "e2", "source": "conv-1", "target": "sec-IPC-302", "label": "CITES" }
    ]
  }
}
```

### `GET /api/graph/message/:sessionId/:messageId`

Fetch the focused conflict and citation graph for a single message/response.

Path Params:
- `sessionId`: The ID of the chat session
- `messageId`: The specific message ID

Success response:

```json
{
  "success": true,
  "graph": {
    "nodes": [
      { "id": "message-1", "type": "card", "label": "Case Analysis" },
      { "id": "conflict-1", "type": "section", "label": "Section 101" }
    ],
    "edges": [
      { "id": "e1", "source": "message-1", "target": "conflict-1", "label": "FLAGGED" }
    ]
  }
}
```

### `GET /api/graph/project`

Fetch the global knowledge graph spanning all active user sessions and known legal act relationships.

Success response:
- Similar structure to Session Graph but includes many-to-many act relationships from `LegalGraph`.

## Auth Header Format

Use this header for protected routes:

```txt
Authorization: Bearer <your_jwt_token>
```

## Current Route Summary

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/query`
- `GET /api/query/export`
- `GET /api/admin/documents`
- `GET /api/admin/documents/:docId/download`
- `POST /api/admin/upload`
- `POST /api/admin/process`
- `GET /api/graph/session/:sessionId`
- `GET /api/graph/message/:sessionId/:messageId`
- `GET /api/graph/project`
