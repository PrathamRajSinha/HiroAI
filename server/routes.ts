import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize Gemini AI
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || "");

  // Generate coding interview question
  app.post("/api/generate-question", async (req, res) => {
    try {
      const { type, difficulty, roomId } = req.body;
      
      if (!type || !difficulty) {
        return res.status(400).json({ error: "Type and difficulty are required" });
      }

      if (!process.env.GOOGLE_GEMINI_API_KEY) {
        return res.status(500).json({ error: "Google Gemini API key not configured" });
      }

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `Generate a clean, well-formatted ${type} interview question for a frontend developer at ${difficulty} level. 

Requirements:
- Use plain text formatting without markdown symbols like ** or ##
- Structure with clear sections: Title, Description, Requirements, and Expected Output
- Beginner-to-intermediate difficulty level
- Practical and relevant to real-world scenarios
- Use simple numbering (1., 2., 3.) for lists
- Use bullet points with - for sub-items
- Keep formatting clean and readable without special characters

Format the response as a professional interview question that reads naturally.`;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const question = response.text();

      // Store question for the room if roomId is provided
      if (roomId) {
        console.log(`Storing question for room ${roomId}:`, question.substring(0, 100) + "...");
        await storage.setRoomQuestion(roomId, question);
      }

      res.json({ question });
    } catch (error) {
      console.error("Error generating question:", error);
      res.status(500).json({ error: "Failed to generate question" });
    }
  });

  // Get current question for a room
  app.get("/api/room/:roomId/question", async (req, res) => {
    try {
      const { roomId } = req.params;
      const question = await storage.getRoomQuestion(roomId);
      
      console.log(`Fetching question for room ${roomId}:`, question ? "Found" : "Not found");
      
      if (!question) {
        return res.json({ question: null });
      }

      res.json({ question });
    } catch (error) {
      console.error("Error fetching room question:", error);
      res.status(500).json({ error: "Failed to fetch question" });
    }
  });

  // Generate code feedback summary
  app.post("/api/generate-summary", async (req, res) => {
    try {
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ error: "Code is required" });
      }

      if (!process.env.GOOGLE_GEMINI_API_KEY) {
        return res.status(500).json({ error: "Google Gemini API key not configured" });
      }

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `You're an interview assistant. Analyze the candidate's code and provide clean, professional feedback without markdown formatting.

Code to analyze:
${code}

Requirements:
- Use plain text without ** or ## symbols
- Structure feedback clearly with sections like: Strengths, Areas for Improvement, Overall Assessment
- Use simple numbering (1., 2., 3.) and bullet points with -
- Keep tone constructive and professional
- Focus on code quality, logic, and best practices
- Avoid special formatting characters

Provide feedback that helps both interviewer and candidate understand the code quality.`;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const summary = response.text();

      res.json({ summary });
    } catch (error) {
      console.error("Error generating summary:", error);
      res.status(500).json({ error: "Failed to generate summary" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
