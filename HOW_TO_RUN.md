# 🚀 Quick Setup Guide

Follow these simple steps to clone, configure, and run both the Frontend and Backend of the Municipal RAG project.

### 1. Clone the Repository
```bash
git clone https://github.com/AshikAHegde/MuncipalRag/
cd "7 EDI RAG PROJECT"
```

### 2. Setup & Run Backend
Open a new terminal and navigate to the backend directory:
```bash
cd backend

# Install dependencies (Crucial: Use legacy peer deps flag due to strict peer dependency requirements like canvas/pdf-parse)
npm install --legacy-peer-deps

# Start the development server
npm run dev
```
*(Make sure to set up your `.env` file with MongoDB, OpenAI, and other necessary API keys before running).*


### 3. Setup & Run Frontend
Open a different terminal window and navigate to the frontend directory:
```bash
cd frontend

# Install dependencies 
npm install --legacy-peer-deps

# Start the frontend app
npm run dev
```
*(Make sure to configure the correct `.env` files for the frontend if required)*.

---
### 🌐 Access the App
Once both commands are running:
- **Frontend App** will be typically available at `http://localhost:3000` (or `http://localhost:5173`)
- **Backend API** runs separately based on your PORT configurations.
