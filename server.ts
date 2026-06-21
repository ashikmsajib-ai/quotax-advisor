import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post("/api/generate-signal", async (req, res) => {
  try {
    const { prompt, apiKey: clientApiKey, engine = "GEMINI" } = req.body;
    let apiKey = process.env.GEMINI_API_KEY || clientApiKey;

    if (engine === "OPENROUTER") {
      apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: "OpenRouter API key not configured" });
      }

      const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
        model: "anthropic/claude-3.5-sonnet",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 800,
        response_format: { type: "json_object" }
      }, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.APP_URL || "https://quotax-advisor.com",
          "X-Title": "Quotax Advisor"
        }
      });

      const data = response.data.choices[0].message.content;
      let parsed = JSON.parse(data);
      return res.json(parsed);
    }

    // Gemini fallback
    if (!apiKey) {
      return res.status(400).json({ error: "No API Key provided" });
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
      config: {
        temperature: 0.15,
        maxOutputTokens: 600,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            signal: { type: 'STRING', enum: ['BUY', 'SELL', 'NEUTRAL'] },
            confidence: { type: 'NUMBER' },
            rationale: { type: 'STRING' },
            targetPrice: { type: 'NUMBER' },
            stopLoss: { type: 'NUMBER' },
            positionSizePct: { type: 'NUMBER' }
          },
          required: ['signal', 'confidence', 'rationale']
        }
      }
    });

    let parsed;
    try {
      const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch (e) {
      parsed = { signal: 'NEUTRAL', confidence: 0.5, rationale: 'Parse error' };
    }

    res.json(parsed);
  } catch (error: any) {
    console.error('Signal generation error:', error);
    res.status(500).json({ error: error.message || "Internal error" });
  }
});

// Vite for dev
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Quotax Advisor running on port ${PORT}`);
});
