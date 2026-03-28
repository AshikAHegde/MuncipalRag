# RAG Application Project Report

This report outlines the architecture, technology stack, and crucial components used to build the Municipal Rules Retrieval-Augmented Generation (RAG) system.

## 1. Core Technology Stack 💻

The project is built using the **MERN** (MongoDB, Express, React, Node.js) stack, heavily enhanced with modern utilities:

### 🤖 AI Models & Database (Core RAG Engines)
- **Vector Database (VB):** **MongoDB Atlas** (using `$vectorSearch` index for advanced semantic search).
- **Embedding Model:** **Google `embedding-001`** (Converts document chunk text into 768-dimensional coordinate vectors).
- **LLM Model (Text Generation):** **Google `gemini-1.5-flash`** (High-speed model with a generous free tier, replacing OpenAI).

### 📂 Folder Structure (Kya Kahan Par Hai?)
- `backend/models/Document.js` ➔ Database schema for saving vector embeddings and text chunks.
- `backend/utils/ragUtils.js` ➔ Here lies the core AI logic (OpenAI embedding generation, Text chunking, and LLM calling code).
- `backend/controllers/adminController.js` ➔ Code for handling PDF reading, stripping text via `pdf-parse`, chunking it, and saving it to Atlas.
- `backend/controllers/queryController.js` ➔ Code for taking user questions, running the `$vectorSearch`, and asking the LLM for the final answer.
- `frontend/src/components/AdminUpload.jsx` ➔ Admin UI screen to Drag & Drop PDFs.
- `frontend/src/components/SearchArea.jsx` ➔ Main User UI screen to ask questions (Chat Interface).
- `frontend/src/components/AnswerCard.jsx` ➔ The UI card that displays the AI answer formatting (Typewriter effect, Sources markdown, etc).

### 🖥️ Frontend
- **Framework:** React 18 powered by **Vite** (for lightning-fast HMR and optimized builds).
- **Styling:** **Tailwind CSS v4** setup natively using the `@tailwindcss/vite` plugin and CSS variable themes (`@theme`).
- **Icons:** `lucide-react` for clean, modern SVG icons.
- **Animations:** `framer-motion` for smooth rendering, page transitions, and the chat response entering effect.
- **Markdown Rendering:** `react-markdown` to properly format the OpenAI LLM text (handling bolding, lists, code blocks, etc.).
- **Uploads:** `react-dropzone` for the slick drag-and-drop admin file upload interface.
- **Utilities:** `clsx` and `tailwind-merge` to handle dynamic tailwind classes without specificity conflicts (Shadcn UI style).
- **API Client:** `axios` for communicating with the Express backend.

### Backend
- **Server:** Node.js with **Express.js**.
- **Database:** **MongoDB Atlas** utilized via the `mongoose` ODM.
- **Vector Search:** MongoDB Atlas **Vector Search index** (`$vectorSearch` aggregation pipeline) used to find chunks most semantically similar to the user's query.
- **AI Models:** **OpenAI API**
  - **Embeddings:** `text-embedding-3-small` (generates the 1536-dimensional vectors for text comparison).
  - **LLM:** `gpt-4o-mini` (takes the top database search results as context and generates the final human-readable answer).
- **File Parsing:** 
  - `multer` (to handle incoming multipart/form-data PDF file uploads in RAM).
  - `pdf-parse` (to strip out and extract raw text from the binary PDF files).

---

## 2. Important Architectural Logic 🧠

### A. The Ingestion Pipeline (Admin Flow)
1. **Upload:** Admin drops a PDF into the React Dropzone, which is sent as `multipart/form-data` to the Express backend.
2. **Text Extraction:** Multer holds the PDF in a memory buffer. `pdf-parse` reads this buffer and returns a massive string of text.
3. **Chunking Mechanism:** The text is split into chunks of approximately **500 words**, with an **overlap of 100 words**. Overlapping ensures that context is not accidentally lost if a sentence gets cut in half.
4. **Vectorization:** Each chunk is sent to the OpenAI Embeddings API, which converts the human text into an array of floating-point numbers (a vector).
5. **Storage:** The raw text chunk, its vector embedding, the source document name, and an estimated page number are saved to MongoDB.

### B. The Query Pipeline (User Flow)
1. **Search Request:** The user types a question ("What is the water tax?").
2. **Query Vectorization:** The backend instantly translates the user's question into a vector using the identical OpenAI embedding model.
3. **Atlas Vector Search:** MongoDB compares the question's vector against all document vectors in the database using **Cosine Similarity**, returning the top 5 most relevant text chunks.
4. **LLM Synthesis:** The Express server injects those 5 text chunks into a strict system prompt ("You are a municipal assistant. Answer ONLY using the following context...").
5. **UI Rendering:** The React UI receives the generated answer and the source references. It uses a custom `useEffect` to simulate a "typing" animation and renders the text via `react-markdown`.

---

## 3. Important Setup Variables ⚙️

To run safely, the two environments require specific Environment Variables:

**Backend (`/backend/.env`)**
- `PORT`: Port for the API server (e.g., 5000).
- `MONGODB_URI`: Must be an Atlas URI pointing to a cluster with a configured Vector Index.
- `OPENAI_API_KEY`: A valid OpenAI API key with credit balance to use models.

**Frontend (`/frontend/.env`)**
- `VITE_API_URL`: Points to the backend endpoint (e.g., `http://localhost:5000`).

---

## 4. UI/UX Highlights ✨
- **Dark Mode Engine:** A custom script toggle (`dark` class on root HTML elements) combined with Tailwind's Native Dark Mode targeting (`dark:` prefix classes and `color-scheme`).
- **Smooth Feedback:** Debounced states to prevent API spam, empty state SVG visuals, and Skeleton loaders for loading states.
- **Copy & Sources feature:** Quick copy-to-clipboard button and expandable accordion to let users verify the exact rulebook sources the AI cited.
