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

module.exports = {
  generateGroundedAnswer
};
