const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta";
const apiKey = process.env.GEMINI_API_KEY;

async function run(){
  const response = await fetch(`${GEMINI_API_URL}/models/gemini-2.5-flash:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "Who won the superbowl in 2024?" }] }],
      tools: [{ googleSearch: {} }]
    })
  });
  const body = await response.json();
  console.log(JSON.stringify(body, null, 2));
}

require("dotenv").config({ path: "./backend/.env" });
run().catch(console.error);
