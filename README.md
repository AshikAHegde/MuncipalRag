# LegalFlow — AI-Powered Legal Intelligence Platform

> A multi-agent RAG (Retrieval-Augmented Generation) system that helps lawyers and legal teams analyze client cases across Criminal, Civil, Corporate, and Tax law domains using AI-driven document retrieval and structured conflict detection.

---

## 🔍 The Problem

Legal professionals in India face a critical workflow bottleneck:

1. **Manual Legal Research is Slow** — Lawyers spend hours cross-referencing statutes, provisions, and case law across multiple legal domains (Criminal, Civil, Corporate, Tax). A single client case can involve overlapping jurisdictions that require separate research for each domain.

2. **No Cross-Domain Conflict Detection** — When a client report involves violations that span multiple legal domains (e.g., a corporate fraud case with both criminal and tax implications), lawyers must manually identify these cross-domain connections. This is error-prone and time-consuming.

3. **Unstructured Client Case Management** — Lawyers interact with multiple clients daily, generating scattered conversation histories and legal analyses. Without proper organization, it becomes impossible to track which client asked what, revisit previous analyses, or maintain a structured audit trail of legal advice given.

4. **Language Barriers** — Many legal practitioners and their clients in India operate in Hindi or Marathi, but most legal tech tools are English-only.

5. **No Grounded AI for Law** — Generic AI chatbots hallucinate legal provisions. Lawyers need answers that are strictly grounded in the actual text of uploaded legal documents — no fabricated sections, no invented penalties.

---

## 💡 Our Solution

**LegalFlow** is a full-stack AI platform that solves each of these problems with a purpose-built architecture:

### Multi-Agent Domain Routing
Instead of a single AI model trying to handle all of law, we deploy **4 specialized domain agents** (Criminal, Civil, Corporate, Tax) that run **in parallel**. Each agent retrieves provisions only from its own domain-indexed vector store and analyzes the client report against domain-specific legal rules.

### RAG-Grounded Legal Answers
Every answer is generated strictly from legal PDFs uploaded and indexed by the admin. The system uses **Pinecone** for vector similarity search and **Groq LLMs** for fast inference, ensuring that all responses cite actual provisions from real legal documents — zero hallucination.

### Structured Conflict Detection
In **Lawyer Mode**, the system doesn't just answer questions — it produces a full **Conflict Report** with:
- Section-by-section violation cards
- Cross-domain impact analysis
- Recommended legal responses
- Severity-coded domain badges (Criminal = red, Civil = amber, Corporate = blue, Tax = green)

### Personalized Lawyer Client Dashboard
Each lawyer using the platform gets a **dedicated client management dashboard** that organizes all their client interactions, case sessions, and legal analyses in one place. Instead of scattered chat threads, the dashboard provides:
- A structured overview of all active client cases
- Organized session history per client
- Quick access to previous conflict reports and legal analyses
- The ability to delete or manage individual chat sessions
- A centralized command center to track case progress across all clients

This ensures that every lawyer has a clear, organized workspace — no more digging through unstructured conversations to find a specific client's case analysis.

### Multilingual Support
Full UI and AI response support in **English**, **Hindi (हिंदी)**, and **Marathi (मराठी)** — both the interface and the AI-generated legal analysis adapt to the selected language.

### Interactive Legal Knowledge Graph
For lawyer users, a **3D force-directed graph visualization** maps the relationships between legal provisions, conflicts, and domains — making it easy to see how different laws interact in a single client case.

---

## 🎯 Target Users

This platform is purpose-built for **two distinct audiences**, each with very different needs:

### 1. Common Citizens / General Users
Everyday people who need quick, reliable legal guidance — without hiring a lawyer for simple questions.

- **What they do:** Ask plain-language legal questions like *"What is the penalty for late property tax payment?"* or *"Can my landlord evict me without notice?"*
- **What they get:** A RAG-grounded answer sourced directly from indexed legal documents, with exact page and section citations — in English, Hindi, or Marathi
- **Why it matters:** Legal literacy in India is low. Most citizens can't afford a lawyer for basic queries. This gives them trustworthy, document-backed legal answers instantly — no jargon, no hallucination

### 2. Lawyers / Legal Professionals
Practicing lawyers who need deep, structured, multi-domain analysis for their client cases.

- **What they do:** Paste an entire client report (e.g., a police complaint, a contract dispute summary, a tax notice) into **Lawyer Mode**
- **What they get:**
  - All 4 legal domain agents (Criminal, Civil, Corporate, Tax) scan the report **simultaneously**
  - A structured **Conflict Report** with section-level violation cards, cross-domain impact flags, and recommended legal responses
  - An interactive **3D Legal Knowledge Graph** showing how provisions and conflicts are connected
  - A **Personalized Client Dashboard** that organizes all their client interactions, case sessions, and analyses — so they never lose track of a case
  - Exportable **PDF/Excel audit reports** for court filings or client communication
- **Why it matters:** A lawyer handling 20+ clients can't afford to manually cross-reference statutes across 4 legal domains for each case. This platform automates the entire analysis pipeline and keeps everything organized per client

> **In short:** Common users get a smart legal assistant. Lawyers get an AI-powered legal war room.

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                   │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────────┐   │
│  │ Auth     │  │ Chat     │  │ Dashboard │  │ Admin Upload  │   │
│  │ (Login/  │  │ Workspace│  │ (Client   │  │ (PDF Index +  │   │
│  │ Signup)  │  │ (General │  │  Mgmt)    │  │  Domain Tag)  │   │
│  │          │  │ + Lawyer)│  │           │  │               │   │
│  └──────────┘  └──────────┘  └───────────┘  └───────────────┘   │
│                       ┌───────────────┐                          │
│                       │ 3D Knowledge  │                          │
│                       │ Graph (Three) │                          │
│                       └───────────────┘                          │
└──────────────────────────┬───────────────────────────────────────┘
                           │ REST API
┌──────────────────────────▼───────────────────────────────────────┐
│                    BACKEND (Node.js + Express)                    │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   Agent Orchestrator                         │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │ │
│  │  │ Criminal │ │  Civil   │ │Corporate │ │   Tax    │       │ │
│  │  │  Agent   │ │  Agent   │ │  Agent   │ │  Agent   │       │ │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘       │ │
│  │       └──────┬──────┴──────┬─────┴──────┬─────┘             │ │
│  │              ▼             ▼            ▼                   │ │
│  │        Retrieval Agent (Pinecone Vector Search)             │ │
│  │              ▼                                              │ │
│  │        Comparison Agent (Cross-Domain Linker)               │ │
│  │              ▼                                              │ │
│  │        Report Agent (Structured Output Generator)           │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ Auth     │  │ Query    │  │ Graph    │  │ Speech (TTS/STT) │ │
│  │ Routes   │  │ Routes   │  │ Routes   │  │ Routes           │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
└──────────┬───────────┬───────────┬───────────┬───────────────────┘
           ▼           ▼           ▼           ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ MongoDB  │ │ Pinecone │ │Cloudinary│ │ Groq +   │
    │ (Users,  │ │ (Vector  │ │ (PDF     │ │ Gemini   │
    │  Chats)  │ │  Store)  │ │ Storage) │ │ (LLM+Emb)│
    └──────────┘ └──────────┘ └──────────┘ └──────────┘
```

---

## ✨ Features

### For All Users (General Mode)
- **AI Legal Q&A** — Ask legal questions in plain language, get grounded answers from indexed law documents
- **Multilingual Interface** — Switch between English, Hindi, and Marathi in real-time
- **Voice Input** — Speak your legal question via microphone, auto-transcribed to text
- **Text-to-Speech** — Listen to AI responses read aloud
- **Chat History** — All conversations are saved and organized into sessions
- **Delete Chat Sessions** — Remove any chat session from history (reflected in database)
- **Source Citations** — Every answer shows the exact page, section, and document it came from

### For Lawyers (Lawyer Mode)
- **Multi-Domain Parallel Scan** — All 4 legal domain agents analyze the client report simultaneously
- **Structured Conflict Report** — Domain-coded violation cards with section, meaning, consequence, solution, and cross-domain impact
- **Legal Knowledge Graph** — Interactive 3D visualization of legal relationships and conflicts
- **Personalized Client Dashboard** — Organized workspace to manage all client cases, sessions, and analyses in one centralized view
- **Exportable Reports** — Download compliance audit reports as PDF or Excel

### For Admins
- **Law Library Management** — Upload legal PDFs with domain tags, section metadata, and keywords
- **OCR Support** — Scanned PDF documents are processed using OCR (Tesseract + Gemini Vision)
- **Cloudinary Storage** — All legal PDFs are stored securely in Cloudinary with private access
- **Document Indexing** — PDFs are chunked, embedded (Gemini), and stored in Pinecone for retrieval

---

## 🛠️ Tech Stack

| Layer         | Technology                                                      |
| ------------- | --------------------------------------------------------------- |
| **Frontend**  | React 19, Vite 8, TailwindCSS 4, React Router 7, Lucide Icons  |
| **3D Graph**  | Three.js, react-force-graph-3d, three-spritetext                |
| **Backend**   | Node.js, Express 5, Mongoose 9                                  |
| **AI / LLM**  | Groq (Llama 3 for inference), Google Gemini (embeddings + TTS)  |
| **Vector DB** | Pinecone (semantic search with domain-filtered retrieval)       |
| **Database**  | MongoDB Atlas (users, chat sessions, documents, legal graphs)   |
| **Storage**   | Cloudinary (legal PDF storage with signed URLs)                 |
| **OCR**       | Tesseract.js + Google Gemini Vision API                         |
| **Auth**      | JWT (role-based: admin, lawyer, user)                           |

---

## 🧠 Backend AI Models and Agents

### AI Models Used

| Model / Service | Provider | Main Use | Backend Location |
| --------------- | -------- | -------- | ---------------- |
| `llama-3.1-8b-instant` | Groq | Main LLM for legal reasoning, answer generation, query rewriting, domain routing, JSON agent outputs, report generation, translation, and conflict audit | `backend/config/appConfig.js`, `backend/services/ragService.js`, `backend/services/legalAgentUtils.js`, `backend/services/translationService.js` |
| `models/gemini-embedding-001` | Google Gemini | Creates vector embeddings for uploaded PDF chunks and user search queries | `backend/config/appConfig.js`, `backend/services/ragService.js` |
| `models/gemini-1.5-flash` | Google Gemini | OCR fallback for scanned PDFs when normal text extraction fails | `backend/services/ragService.js` |
| `models/gemini-2.5-flash` | Google Gemini | Speech-to-text transcription for voice input | `backend/config/appConfig.js`, `backend/services/speechService.js` |
| `models/gemini-2.5-flash-preview-tts` | Google Gemini | Text-to-speech audio generation for AI answers | `backend/config/appConfig.js`, `backend/services/speechService.js` |
| Pinecone vector index | Pinecone | Stores PDF embeddings and performs semantic similarity search with domain filters | `backend/services/ragService.js`, `backend/services/retrievalAgent.js` |

> Main reasoning model: **Groq `llama-3.1-8b-instant`**.  
> Supporting AI models: **Gemini embeddings, OCR, transcription, and TTS**.

### Backend Agents

| Agent / Service | What It Does | Model / Tool Used | Backend Location |
| --------------- | ------------ | ----------------- | ---------------- |
| Agent Orchestrator | Controls the full query flow, detects legal domain, chooses General Mode or Lawyer Mode, and coordinates all agents | Groq LLM + fallback routing logic | `backend/services/agentOrchestrator.js` |
| Retrieval Agent | Rewrites the query, embeds it, searches Pinecone, and returns relevant legal PDF chunks | Groq for query rewrite, Gemini embeddings, Pinecone search | `backend/services/retrievalAgent.js`, `backend/services/ragService.js` |
| General Agent | Generates normal user-facing legal answers from retrieved document context | Groq LLM | `backend/services/generalAgent.js` |
| Criminal Agent | Detects criminal-law conflicts from the client report using retrieved criminal law provisions | Groq LLM | `backend/services/criminalAgent.js` |
| Civil Agent | Detects civil-law conflicts from the client report using retrieved civil law provisions | Groq LLM | `backend/services/civilAgent.js` |
| Corporate Agent | Detects corporate-law conflicts from the client report using retrieved corporate law provisions | Groq LLM | `backend/services/corporateAgent.js` |
| Tax Agent | Detects tax-law conflicts from the client report using retrieved tax law provisions | Groq LLM | `backend/services/taxAgent.js` |
| Comparison Agent | Filters weak/irrelevant conflicts and adds cross-domain impact links | Groq LLM | `backend/services/comparisonAgent.js` |
| Report Agent | Builds the final structured lawyer report with conflicts, sources, recommendations, and summary | Groq LLM | `backend/services/reportAgent.js` |
| Temp Chat / Node Chat Agent | Answers follow-up questions about a selected Legal Knowledge Graph node | Groq LLM | `backend/services/tempChatAgent.js` |
| Translation Service | Translates AI responses while preserving markdown, facts, numbering, and structure | Groq LLM | `backend/services/translationService.js` |
| Speech Service | Converts voice input to text and AI text responses to audio | Gemini transcription + Gemini TTS | `backend/services/speechService.js` |
| Report Export Service | Generates downloadable PDF and Excel reports from saved analysis data | PDFKit + ExcelJS, no LLM | `backend/services/reportService.js` |
| Storage Service | Uploads, downloads, streams, and deletes legal PDFs from cloud storage | Cloudinary, no LLM | `backend/services/storageService.js` |

### Backend AI Flow

1. **Admin uploads PDF** → Cloudinary stores the file.
2. **Text extraction** → LangChain `PDFLoader` extracts text; Gemini `models/gemini-1.5-flash` is used if OCR fallback is needed.
3. **Chunking** → `RecursiveCharacterTextSplitter` splits legal text into chunks.
4. **Embedding** → Gemini `models/gemini-embedding-001` converts chunks into 768-dimensional vectors.
5. **Indexing** → Pinecone stores the vectors with metadata like domain, section, source, page, and keywords.
6. **User asks query** → Groq rewrites the query for better search.
7. **Retrieval** → Gemini embeds the query and Pinecone returns matching legal chunks.
8. **General Mode** → General Agent uses Groq to answer from retrieved legal context.
9. **Lawyer Mode** → Criminal, Civil, Corporate, and Tax agents run in parallel using Groq.
10. **Conflict audit** → Comparison Agent uses Groq to remove weak matches and add cross-domain impact.
11. **Final report** → Report Agent uses Groq to generate the structured legal report with cited sources.
12. **Optional language/audio** → Translation uses Groq, transcription uses Gemini Flash, and TTS uses Gemini TTS.

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- MongoDB (local or Atlas)
- Pinecone account (vector database)
- Groq API key
- Google Gemini API key
- Cloudinary account

### 1. Clone the Repository
```bash
git clone https://github.com/your-repo/legalflow.git
cd legalflow
```

### 2. Backend Setup
```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory:
```env
MONGODB_URI=mongodb+srv://your-connection-string
JWT_SECRET=your-jwt-secret

PINECONE_API_KEY=your-pinecone-api-key
PINECONE_ENVIRONMENT=your-pinecone-environment
PINECONE_INDEX_NAME=your-pinecone-index

GEMINI_API_KEY=your-gemini-api-key
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=llama-3.1-8b-instant
GEMINI_TRANSCRIPTION_MODEL=models/gemini-2.5-flash
GEMINI_TTS_MODEL=models/gemini-2.5-flash-preview-tts

CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-key
CLOUDINARY_API_SECRET=your-cloudinary-secret
```

Start the backend:
```bash
npm run dev
```
Server runs on `http://localhost:5000`

### 3. Frontend Setup
```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend/` directory:
```env
VITE_API_URL=http://localhost:5000
```

Start the frontend:
```bash
npm run dev
```
App runs on `http://localhost:5173`

---

## 📡 API Endpoints

| Method   | Endpoint                          | Auth     | Description                          |
| -------- | --------------------------------- | -------- | ------------------------------------ |
| `POST`   | `/api/auth/signup`                | Public   | Register a new user/lawyer           |
| `POST`   | `/api/auth/login`                 | Public   | Login and get JWT token              |
| `GET`    | `/api/query/history`              | Required | Get all chat sessions for the user   |
| `POST`   | `/api/query`                      | Required | Ask a legal question (general/lawyer)|
| `DELETE` | `/api/query/session/:sessionId`   | Required | Delete a specific chat session       |
| `GET`    | `/api/query/export`               | Required | Export compliance report (PDF/Excel) |
| `GET`    | `/api/graph/session/:sessionId`   | Required | Get knowledge graph for a session    |
| `GET`    | `/api/graph/message/:sid/:mid`    | Required | Get focused conflict graph           |
| `POST`   | `/api/speech/transcribe`          | Required | Transcribe voice to text             |
| `POST`   | `/api/speech/synthesize`          | Required | Text-to-speech synthesis             |
| `GET`    | `/api/admin/documents`            | Admin    | List all uploaded documents          |
| `POST`   | `/api/admin/upload`               | Admin    | Upload and index a legal PDF         |
| `DELETE` | `/api/admin/documents/:docId`     | Admin    | Delete a document and its vectors    |

---

## 👥 User Roles

| Role       | Capabilities                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| **User**   | General legal Q&A, multilingual chat, voice input, chat history management                           |
| **Lawyer** | Everything in User + Lawyer Mode (multi-domain conflict scan), Knowledge Graph, Client Dashboard, Report Export |
| **Admin**  | Everything in User + Law Library management (upload, tag, delete legal PDFs)                          |

---

## 📁 Project Structure

```
├── backend/
│   ├── app.js                    # Express server entry point
│   ├── config/                   # App config, DB connection, language config
│   ├── controllers/              # Route handlers (auth, query, admin, graph, speech)
│   ├── middleware/                # Auth middleware, error handler, language resolver
│   ├── models/                   # Mongoose schemas (User, UserChat, Document, LegalGraph)
│   ├── routes/                   # Express route definitions
│   └── services/                 # Core business logic
│       ├── agentOrchestrator.js  # Multi-agent pipeline coordinator
│       ├── ragService.js         # RAG pipeline (embed, retrieve, generate)
│       ├── criminalAgent.js      # Criminal law domain agent
│       ├── civilAgent.js         # Civil law domain agent
│       ├── corporateAgent.js     # Corporate law domain agent
│       ├── taxAgent.js           # Tax law domain agent
│       ├── retrievalAgent.js     # Pinecone vector retrieval
│       ├── comparisonAgent.js    # Cross-domain conflict linker
│       ├── reportAgent.js        # Structured legal report generator
│       ├── generalAgent.js       # General mode response generator
│       └── storageService.js     # Cloudinary file operations
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AppShell.jsx              # Main layout with sidebar navigation
│   │   │   ├── SearchArea.jsx            # Chat workspace (history + messages + input)
│   │   │   ├── AnswerCard.jsx            # AI response renderer (markdown + conflict cards)
│   │   │   ├── LegalKnowledgeGraph.jsx   # 3D force-directed graph visualization
│   │   │   ├── AdminUpload.jsx           # PDF upload interface for admins
│   │   │   └── AuthForm.jsx              # Login/signup form
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx         # Personalized lawyer client dashboard
│   │   │   ├── ProfilePage.jsx           # User profile management
│   │   │   └── SearchPage.jsx            # Chat workspace page
│   │   ├── context/                      # React auth context
│   │   ├── hooks/                        # Custom hooks (useAuth)
│   │   └── lib/                          # API client, i18n translations, utilities
│   └── index.html
│
└── README.md
```

---

## 🔒 Security

- **JWT Authentication** — All API endpoints (except auth) require a valid Bearer token
- **Role-Based Access Control** — Admin, Lawyer, and User roles with granular permissions
- **Password Hashing** — bcryptjs with salt rounds
- **Domain Enforcement** — Lawyer accounts must have an assigned legal domain
- **Private File Storage** — Legal PDFs stored in Cloudinary with signed private URLs

---

## 📄 License

This project is proprietary and developed as part of the EDI RAG Project.
