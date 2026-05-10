import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://rag-1-yo58.onrender.com";

function UploadView({ onIndexed }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleFileChange(event) {
    const selectedFile = event.target.files[0] || null;
    setFile(selectedFile);
    setStatus(selectedFile ? "Ready to index." : "");
    setError(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!file) {
      setStatus("Please choose a document first.");
      setError(true);
      return;
    }

    setLoading(true);
    setStatus("Indexing document...");
    setError(false);

    try {
      const formData = new FormData();
      formData.append("document", file);

      const response = await fetch(`${BACKEND_URL}/api/upload`, {
        method: "POST",
        body: formData
      });
      const result = await response.json();

      if (!response.ok) {
        setStatus(result.error || "Upload failed.");
        setError(true);
        return;
      }

      onIndexed(result);
    } catch (requestError) {
      setStatus("Upload failed.");
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="upload-view">
      <div className="upload-card">
        <div className="brand-block">
          <p className="eyebrow">Document first</p>
          <h1>Upload a source to start chatting</h1>
          <p className="subcopy">
            The chatbot unlocks only after your PDF or text file is indexed.
          </p>
        </div>

        <form className="upload-form" onSubmit={handleSubmit}>
          <label className={`drop-zone ${file ? "has-file" : ""}`} htmlFor="documentInput">
            <span className="file-icon">PDF</span>
            <strong>{file ? file.name : "Choose a PDF, TXT, or MD file"}</strong>
            <small>Answers will be restricted to the uploaded document.</small>
            <input
              id="documentInput"
              name="document"
              type="file"
              accept=".pdf,.txt,.md"
              onChange={handleFileChange}
              disabled={loading}
            />
          </label>
          <p className={`status-text ${error ? "error" : ""}`}>{status}</p>
          <button type="submit" disabled={loading}>
            {loading ? "Indexing..." : "Index document"}
          </button>
        </form>
      </div>
    </section>
  );
}

function Message({ message }) {
  return (
    <article className={`message ${message.type}`}>
      <div>{message.content}</div>
      {message.sources?.length > 0 && (
        <details className="sources-details">
          <summary>View {message.sources.length} sources used</summary>
          <div className="sources">
            {message.sources.map((source) => (
              <div className="source" key={source.id}>
                <code>
                  {source.id} · score {source.score}
                </code>
                <span>{source.text}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </article>
  );
}

function ChatView({ documentMetadata, onChangeDocument }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: crypto.randomUUID(),
      type: "answer",
      content: "Document indexed. Ask a question from the document."
    }
  ]);

  async function handleAsk(event) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    setQuery("");
    setLoading(true);
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), type: "user", content: trimmedQuery }
    ]);

    try {
      const response = await fetch(`${BACKEND_URL}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmedQuery })
      });
      const result = await response.json();

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          type: response.ok && result.found ? "answer" : "answer miss",
          content: response.ok ? result.answer : result.error || "Request failed.",
          sources: result.sources || []
        }
      ]);
    } catch (requestError) {
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), type: "answer miss", content: "Request failed." }
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="workspace">
      <aside className="panel">
        <div>
          <p className="eyebrow">Document chat</p>
          <h2>Notebook RAG</h2>
        </div>

        <div className="doc-card">
          <div className="doc-row">
            <span>Name</span>
            <strong>{documentMetadata?.name || "No document"}</strong>
          </div>
          <div className="doc-row">
            <span>Chunks</span>
            <strong>{documentMetadata?.chunkCount || 0}</strong>
          </div>
          <div className="doc-row">
            <span>Strategy</span>
            <strong>{documentMetadata?.chunking || "-"}</strong>
          </div>
        </div>

        <button className="secondary-button" type="button" onClick={onChangeDocument}>
          Change document
        </button>
      </aside>

      <section className="chat">
        <div className="messages">
          {messages.map((message) => (
            <Message key={message.id} message={message} />
          ))}
        </div>

        <form className="ask-form" onSubmit={handleAsk}>
          <input
            type="text"
            autoComplete="off"
            placeholder="Ask from the document"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={loading}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? "..." : "Ask"}
          </button>
        </form>
      </section>
    </section>
  );
}

function App() {
  const [documentMetadata, setDocumentMetadata] = useState(null);

  return (
    <main className="shell">
      {documentMetadata ? (
        <ChatView
          documentMetadata={documentMetadata}
          onChangeDocument={() => setDocumentMetadata(null)}
        />
      ) : (
        <UploadView onIndexed={setDocumentMetadata} />
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
