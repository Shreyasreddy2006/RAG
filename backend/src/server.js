const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const DocumentStore = require("./documentStore");

const app = express();
const port = process.env.PORT || 3000;
const root = path.resolve(__dirname, "..");
const frontendBuildPath = path.resolve(root, "..", "frontend", "dist");
const upload = multer({
  dest: path.join(root, "data", "uploads"),
  limits: {
    fileSize: 12 * 1024 * 1024
  }
});

const store = new DocumentStore({
  defaultDocumentPath: path.join(root, "data", "assignment.pdf"),
  vectorStorePath: path.join(root, "data", "vector-store.json")
});

app.use(cors());
app.use(express.json());
app.use(express.static(frontendBuildPath));

app.get("/api/health", (request, response) => {
  response.json({ ok: true, document: store.getMetadata() });
});

app.get("/api/document", (request, response) => {
  response.json(store.getMetadata());
});

app.post("/api/upload", upload.single("document"), async (request, response) => {
  try {
    if (!request.file) {
      return response.status(400).json({ error: "No document uploaded." });
    }

    const metadata = await store.loadDocument(request.file.path, request.file.originalname);
    return response.json(metadata);
  } catch (error) {
    return response.status(400).json({ error: error.message });
  }
});

app.post("/api/ask", async (request, response) => {
  const query = String(request.body?.query || "").trim();

  if (!query) {
    return response.status(400).json({ error: "Query is required." });
  }

  try {
    return response.json(await store.ask(query));
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
});

app.use((request, response) => {
  response.sendFile(path.join(frontendBuildPath, "index.html"));
});

store
  .initialize()
  .then(() => {
    const server = app.listen(port, () => {
      console.log(`Document-only RAG app running at http://localhost:${port}`);
    });
    server.on("error", (err) => {
      console.error("Failed to start server:", err.message);
      process.exit(1);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize document store:", error);
    process.exit(1);
  });
