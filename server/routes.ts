import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize Gemini AI
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || "");

  // Generate coding interview question
  app.post("/api/generate-question", async (req, res) => {
    try {
      const { topic } = req.body;
      
      if (!topic) {
        return res.status(400).json({ error: "Topic is required" });
      }

      if (!process.env.GOOGLE_GEMINI_API_KEY) {
        return res.status(500).json({ error: "Google Gemini API key not configured" });
      }

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `Generate a coding interview question for a frontend developer about ${topic}. The question should be clear and beginner-to-intermediate level. Include a brief description of what the candidate should implement, any specific requirements, and expected difficulty level. Make it practical and relevant to real-world development scenarios.`;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const question = response.text();

      res.json({ question });
    } catch (error) {
      console.error("Error generating question:", error);
      res.status(500).json({ error: "Failed to generate question" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
