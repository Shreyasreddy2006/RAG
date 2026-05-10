# 📚 Document-Only RAG

*A full-stack, strict document-grounded Retrieval-Augmented Generation (RAG) conversational agent.*

## 🌟 Overview

**Document-Only RAG** is a specialized chatbot application designed to interact exclusively with user-uploaded documents. Unlike standard LLM chat interfaces that might hallucinate or rely on outside knowledge, this application strictly limits its answers to the provided context (PDFs, TXTs, or MDs). If the answer isn't in your document, the bot is instructed to gracefully decline and tell you: *"no context found."*

## ✨ Features

- **Strict Grounding**: Zero hallucinations. Answers are synthesized *only* from the retrieved document chunks.
- **Custom Local Vectorizer**: Uses an efficient, in-memory hashed bag-of-words vectorization mechanism with cosine similarity—no external vector database needed!
- **Conversational UI**: A clean, responsive React frontend. Raw retrieved chunks are hidden inside a collapsible "Sources" toggle so you get a natural chat experience while still retaining full transparency.
- **Gemini API Integration**: Uses Google's state-of-the-art `gemini-2.5-flash` model for intelligent, context-aware text generation.

## 🛠️ Technology Stack

- **Frontend**: React, Vite, Vanilla CSS
- **Backend**: Node.js, Express, Multer (for file uploads), `pdf-parse`
- **AI / LLM**: Gemini REST `generateContent` API
- **Storage**: Local File System (`vector-store.json`)

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18 or higher recommended)
- A **Google Gemini API Key** (You can get one from Google AI Studio)

### Installation

1. **Install dependencies** for both the frontend and backend:
   ```bash
   npm run install:all
   ```

2. **Set up environment variables**:
   Create a `.env` file in the `backend/` directory (if it doesn't already exist) and add your API key. Note that we use port `3005` to avoid common port conflicts:
   ```env
   PORT=3005
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-2.5-flash
   ```

---

## 💻 Running the App

### Development Mode

You'll need two separate terminals to run the development servers.

**1. Run the backend:**
```bash
cd backend
npm run dev
```

**2. Run the frontend:**
```bash
cd frontend
npm run dev
```
Once both are running, open your browser and navigate to `http://localhost:5173`.

### Production Mode

To serve the built frontend via the Express backend:

1. Build the React frontend:
   ```bash
   cd frontend
   npm run build
   ```
2. Start the backend server:
   ```bash
   cd backend
   npm start
   ```
Navigate to `http://localhost:3005` in your browser.

---

## 🧠 Architecture & How It Works

1. **Document Ingestion**: The user uploads a supported document (`.pdf`, `.txt`, `.md`).
2. **Chunking**: The backend splits the document into smaller, digestible segments—specifically 115-word chunks with a 28-word overlap to maintain context across boundaries.
3. **Local Embedding**: The text is tokenized, stop-words are removed, and chunks are embedded using a custom local hashing function into a 384-dimensional vector space.
4. **Retrieval**: When a user asks a question, the backend calculates the **Cosine Similarity** and lexical overlap between the question and the chunks to retrieve the most relevant information.
5. **Strict Generation**: 
   - If no relevant context is found during retrieval, the system aborts early.
   - If context is found, it sends the top chunks to Gemini with a strict system prompt.
   - Gemini acts as a conversational agent, returning a natural response synthesized *exclusively* from those chunks.
