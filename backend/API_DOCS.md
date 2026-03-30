# Backend API Docs

Base URL:

```txt
http://localhost:5000
```

All responses are JSON unless noted otherwise.

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
- `history` is optional
- allowed history roles are `user` and `model`

Success response:

```json
{
  "success": true,
  "answer": "The answer generated from the indexed PDF context.",
  "sources": [
    {
      "page": 4,
      "section": "Match 1",
      "text": "Relevant chunk text from the PDF.",
      "score": 0.91,
      "source": "sample.pdf"
    }
  ]
}
```

Common errors:
- `400` missing query
- `500` embedding, Pinecone, Groq, or server error

## Admin

Important note:
- the admin routes exist under `/api/admin`
- right now they are not protected by `protect` or `adminOnly` middleware
- if you want, these can be locked later to admin-only access

### `GET /api/admin/documents`

List uploaded PDF files from the `uploads` folder.

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
- `500` could not read uploads

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
multipart/form-data
```

Form field:
- `file` as a PDF

Success response:

```json
{
  "success": true,
  "docId": "975c6d1b-1024-4e11-8067-7e4771c97101",
  "fileName": "m.pdf",
  "pages": 12,
  "message": "PDF uploaded successfully."
}
```

Common errors:
- `400` missing file
- `400` non-PDF file
- `400` multer validation error
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
- `GET /api/admin/documents`
- `GET /api/admin/documents/:docId/download`
- `POST /api/admin/upload`
- `POST /api/admin/process`
