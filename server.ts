import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const key = process.env.OPENAI_API_KEY;
    if (!key || key === "your_openai_api_key_here") {
      throw new Error("OPENAI_API_KEY is not configured. Please add it to your secrets/environment.");
    }
    openaiClient = new OpenAI({ apiKey: key });
  }
  return openaiClient;
}

// Medical Assistant Endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    const openai = getOpenAI();

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a professional medical assistant. You provide helpful, clear, and accurate health information and recommendations. IMPORTANT: Always include a disclaimer that you are an AI and your advice does not replace professional medical consultation. Be empathetic and clear.",
        },
        ...messages,
      ],
      temperature: 0.7,
    });

    res.json(response.choices[0].message);
  } catch (error: any) {
    console.error("OpenAI Error:", error);
    const message = error.message.includes("OPENAI_API_KEY") 
      ? "OpenAI API Key is missing or invalid. Please check your configuration."
      : "An error occurred while processing your request.";
    res.status(500).json({ error: message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
