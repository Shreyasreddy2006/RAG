const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta";

function extractTextFromGeminiResponse(responseBody) {
  return (
    responseBody?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join(" ")
      .trim() || ""
  );
}

function normalizeAnswer(answer) {
  const cleaned = String(answer || "").replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.toLowerCase().includes("no context found")) {
    return "no context found";
  }
  return cleaned;
}

async function generateGroundedAnswer({ query, contextChunks }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (!apiKey || apiKey === "paste-your-gemini-api-key-here") {
    throw new Error("GEMINI_API_KEY is missing. Add it to backend/.env.");
  }

  const context = contextChunks
    .map((chunk) => `[${chunk.id}]\n${chunk.text}`)
    .join("\n\n");

  const response = await fetch(`${GEMINI_API_URL}/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text:
              "You are a strict document-grounded conversational AI assistant. Answer the user's QUESTION properly and naturally using only the provided CONTEXT. " +
              "Do not use outside knowledge. Formulate a clear, coherent, and conversational response instead of just copy-pasting raw disjointed text or document formatting (like Roman numerals). " +
              "If the answer is not clearly present in the CONTEXT, reply exactly: no context found. Keep answers concise."
          }
        ]
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `CONTEXT:\n${context}\n\nQUESTION:\n${query}`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0,
        topP: 0.1,
        maxOutputTokens: 1000
      }
    })
  });

  const responseBody = await response.json();

  if (!response.ok) {
    const message = responseBody?.error?.message || "Gemini request failed.";
    throw new Error(message);
  }

  return normalizeAnswer(extractTextFromGeminiResponse(responseBody));
}

async function evaluateContext({ query, contextChunks }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (!apiKey || apiKey === "paste-your-gemini-api-key-here") {
    throw new Error("GEMINI_API_KEY is missing. Add it to backend/.env.");
  }

  const context = contextChunks
    .map((chunk) => `[${chunk.id}]\n${chunk.text}`)
    .join("\n\n");

  const response = await fetch(`${GEMINI_API_URL}/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text:
              "You are a grader evaluating relevance of retrieved documents to a user question. " +
              "If the documents contain semantic meaning or facts related to the question, grade them as relevant. " +
              "Return EXACTLY 'yes' if relevant, or 'no' if not relevant. Do not include any other text."
          }
        ]
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `CONTEXT:\n${context}\n\nQUESTION:\n${query}`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 10
      }
    })
  });

  const responseBody = await response.json();

  if (!response.ok) {
    console.error("Gemini evaluation failed", responseBody);
    return false; // Fail safe to web search
  }

  const result = extractTextFromGeminiResponse(responseBody).toLowerCase().trim();
  return result === "yes";
}

async function generateWebAnswer({ query }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (!apiKey || apiKey === "paste-your-gemini-api-key-here") {
    throw new Error("GEMINI_API_KEY is missing. Add it to backend/.env.");
  }

  const response = await fetch(`${GEMINI_API_URL}/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: "You are a helpful AI assistant. Answer the user's question. You have access to Google Search. Provide a concise, clear answer. If you use search, use it to ground your response."
          }
        ]
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: query
            }
          ]
        }
      ],
      tools: [
        {
          googleSearch: {}
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1000
      }
    })
  });

  const responseBody = await response.json();

  if (!response.ok) {
    const message = responseBody?.error?.message || "Gemini web search request failed.";
    throw new Error(message);
  }

  const answer = extractTextFromGeminiResponse(responseBody);
  return answer || "No relevant information found on the web.";
}

module.exports = {
  generateGroundedAnswer,
  evaluateContext,
  generateWebAnswer
};
