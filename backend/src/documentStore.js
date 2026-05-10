const fs = require("fs/promises");
const path = require("path");
const { PDFParse } = require("pdf-parse");
const { generateGroundedAnswer } = require("./gemini");

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "can", "for", "from",
  "has", "have", "in", "is", "it", "its", "of", "on", "or", "that", "the",
  "their", "this", "to", "was", "what", "when", "where", "which", "who",
  "why", "with", "you", "your", "does", "do", "must", "should", "about",
  "into", "back", "using", "use"
]);

const VECTOR_SIZE = 384;
const MIN_SCORE = 0.04;

function normalizeText(text) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9]+(?:'[a-z0-9]+)?/g) || [])
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function hashToken(token) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % VECTOR_SIZE;
}

function embed(text) {
  const vector = Array(VECTOR_SIZE).fill(0);
  const tokens = tokenize(text);

  for (const token of tokens) {
    vector[hashToken(token)] += 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return magnitude === 0 ? vector : vector.map((value) => value / magnitude);
}

function cosineSimilarity(left, right) {
  let score = 0;
  for (let index = 0; index < left.length; index += 1) {
    score += left[index] * right[index];
  }
  return score;
}

function splitIntoSentences(text) {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9●]|$)|(?=●)/g)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function chunkText(text, chunkSize = 115, overlap = 28) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];

  for (let start = 0; start < words.length; start += chunkSize - overlap) {
    const chunkWords = words.slice(start, start + chunkSize);
    if (chunkWords.length < 12) break;

    chunks.push({
      id: `chunk-${chunks.length + 1}`,
      text: chunkWords.join(" "),
      startWord: start,
      endWord: start + chunkWords.length
    });
  }

  return chunks;
}

async function extractPdfText(filePath) {
  const parser = new PDFParse({ data: await fs.readFile(filePath) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractText(filePath, originalName = filePath) {
  const extension = path.extname(originalName).toLowerCase();

  if (extension === ".pdf") {
    return extractPdfText(filePath);
  }

  if (extension === ".txt" || extension === ".md") {
    return fs.readFile(filePath, "utf8");
  }

  throw new Error("Only PDF, TXT, and MD documents are supported.");
}

function sentenceScore(sentence, queryVector, queryTokens) {
  const sentenceVectorScore = cosineSimilarity(embed(sentence), queryVector);
  const sentenceTokens = new Set(tokenize(sentence));
  const overlap = queryTokens.filter((token) => sentenceTokens.has(token)).length;
  return sentenceVectorScore + overlap * 0.08;
}

function buildAnswer(query, chunks) {
  const queryVector = embed(query);
  const queryTokens = tokenize(query);
  const rankedSentences = [];

  for (const chunk of chunks) {
    for (const sentence of splitIntoSentences(chunk.text)) {
      const score = sentenceScore(sentence, queryVector, queryTokens);
      if (score > 0) {
        rankedSentences.push({
          text: sentence,
          score,
          sourceChunkId: chunk.id
        });
      }
    }
  }

  const unique = [];
  const seen = new Set();

  for (const sentence of rankedSentences.sort((a, b) => b.score - a.score)) {
    const key = sentence.text.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(sentence);
    }
    if (unique.length === 3) break;
  }

  if (unique.length === 0) {
    return null;
  }

  return {
    answer: unique.map((sentence) => sentence.text).join(" "),
    sentenceSources: unique.map((sentence) => sentence.sourceChunkId)
  };
}

class DocumentStore {
  constructor({ defaultDocumentPath, vectorStorePath }) {
    this.defaultDocumentPath = defaultDocumentPath;
    this.vectorStorePath = vectorStorePath;
    this.document = null;
  }

  async initialize() {
    await fs.mkdir(path.dirname(this.vectorStorePath), { recursive: true });
    await this.loadDocument(this.defaultDocumentPath, path.basename(this.defaultDocumentPath));
  }

  async loadDocument(filePath, originalName) {
    const rawText = await extractText(filePath, originalName);
    const text = normalizeText(rawText);
    const chunks = chunkText(text).map((chunk) => ({
      ...chunk,
      vector: embed(chunk.text)
    }));

    this.document = {
      name: originalName,
      loadedAt: new Date().toISOString(),
      text,
      chunks
    };

    await fs.writeFile(
      this.vectorStorePath,
      JSON.stringify(
        {
          documentName: this.document.name,
          loadedAt: this.document.loadedAt,
          chunking: "115-word chunks with 28-word overlap",
          vectorDimensions: VECTOR_SIZE,
          chunks: this.document.chunks
        },
        null,
        2
      )
    );

    return this.getMetadata();
  }

  getMetadata() {
    if (!this.document) return null;

    return {
      name: this.document.name,
      loadedAt: this.document.loadedAt,
      chunkCount: this.document.chunks.length,
      chunking: "115-word chunks with 28-word overlap",
      rule: "Answers are extracted only from the loaded document. Missing answers return no context found."
    };
  }

  async ask(query) {
    if (!this.document) {
      return {
        answer: "no context found",
        sources: [],
        found: false
      };
    }

    const queryVector = embed(query);
    const queryTokens = tokenize(query);
    const rankedChunks = this.document.chunks
      .map((chunk) => ({
        ...chunk,
        lexicalOverlap: queryTokens.filter((token) => tokenize(chunk.text).includes(token)).length,
        score: cosineSimilarity(chunk.vector, queryVector)
      }))
      .filter((chunk) => chunk.lexicalOverlap > 0)
      .map((chunk) => ({
        ...chunk,
        score: chunk.score + chunk.lexicalOverlap * 0.12
      }))
      .filter((chunk) => chunk.score >= MIN_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    if (rankedChunks.length === 0) {
      return {
        answer: "no context found",
        sources: [],
        found: false
      };
    }

    const answer = buildAnswer(query, rankedChunks);
    if (!answer) {
      return {
        answer: "no context found",
        sources: [],
        found: false
      };
    }

    const geminiAnswer = await generateGroundedAnswer({
      query,
      contextChunks: rankedChunks
    });

    return {
      answer: geminiAnswer,
      found: geminiAnswer.toLowerCase().trim() !== "no context found",
      sources: rankedChunks.map((chunk) => ({
        id: chunk.id,
        score: Number(chunk.score.toFixed(4)),
        text: chunk.text
      }))
    };
  }
}

module.exports = DocumentStore;
