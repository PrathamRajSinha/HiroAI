import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import { GoogleGenerativeAI } from "@google/generative-ai";
import multer from "multer";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize Gemini AI
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || "");

  // Configure multer for file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'application/pdf') {
        cb(null, true);
      } else {
        cb(new Error('Only PDF files are allowed'));
      }
    },
  });

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
      
      let prompt = `Generate a clean, well-formatted ${type} interview question for a frontend developer at ${difficulty} level.

Requirements:
- Use plain text formatting without markdown symbols like ** or ##
- Keep formatting clean and readable without special characters
- Use simple numbering (1., 2., 3.) for lists
- Use bullet points with - for sub-items
- Practical and relevant to real-world scenarios

`;

      if (type === "Coding") {
        prompt += `For coding questions:
- Include clear problem description and requirements
- Specify expected functionality and constraints
- Mention any specific technologies or patterns to use
- Include example data if helpful`;
      } else if (type === "Behavioral") {
        prompt += `For behavioral questions:
- Focus on past experiences and situations
- Ask about teamwork, problem-solving, or conflict resolution
- Use STAR method framework (Situation, Task, Action, Result)
- Relate to frontend development scenarios`;
      } else if (type === "Situational") {
        prompt += `For situational questions:
- Present hypothetical scenarios in frontend development
- Focus on decision-making and problem-solving approach
- Include technical trade-offs or team dynamics
- Ask how they would handle specific challenges`;
      }

      prompt += `\n\nFormat the response as a professional interview question that reads naturally.`;
      
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

  // Generate questions from profile sources
  app.post("/api/gen-from-source", async (req, res) => {
    try {
      const { type, content, roomId } = req.body;
      
      if (!type || !content) {
        return res.status(400).json({ error: "Type and content are required" });
      }

      if (!["resume", "github", "linkedin"].includes(type)) {
        return res.status(400).json({ error: "Invalid source type" });
      }

      if (!process.env.GOOGLE_GEMINI_API_KEY) {
        return res.status(500).json({ error: "Google Gemini API key not configured" });
      }

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      let sourceDescription = "";
      let contextualPrompt = "";
      
      switch (type) {
        case "resume":
          sourceDescription = "resume";
          contextualPrompt = "Focus on their listed skills, experience, projects, and technologies. Ask about specific achievements, technical challenges they've faced, and how they've applied their skills in real-world scenarios.";
          break;
        case "github":
          sourceDescription = "GitHub repository README";
          contextualPrompt = "Focus on the project's technical stack, architecture, features, and implementation details. Ask about design decisions, challenges faced during development, and specific technical aspects of their work.";
          break;
        case "linkedin":
          sourceDescription = "LinkedIn professional summary";
          contextualPrompt = "Focus on their professional experience, career progression, and highlighted skills. Ask about leadership experiences, cross-functional collaboration, and how they've grown in their roles.";
          break;
      }

      const prompt = `Given this ${sourceDescription}, generate exactly 2 contextual interview questions that challenge the candidate on their background and experience.

${sourceDescription.toUpperCase()} CONTENT:
${content}

REQUIREMENTS:
- Generate exactly 2 questions
- ${contextualPrompt}
- Use plain text formatting without markdown symbols like ** or ##
- Make questions specific to their background, not generic
- Each question should be substantial and thought-provoking
- Questions should be appropriate for a technical interview
- Separate the two questions with a blank line
- Do not number the questions

Format: Present each question as a complete, professional interview question that an interviewer would naturally ask.`;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const generatedText = response.text();

      // Split the response into individual questions
      const questions = generatedText
        .split('\n\n')
        .filter(q => q.trim().length > 0)
        .map(q => q.trim());

      // Store the combined questions for the room if roomId is provided
      if (roomId && questions.length > 0) {
        const combinedQuestions = questions.join('\n\n');
        console.log(`Storing profile-based questions for room ${roomId}:`, combinedQuestions.substring(0, 100) + "...");
        await storage.setRoomQuestion(roomId, combinedQuestions);
      }

      res.json({ questions });
    } catch (error) {
      console.error("Error generating questions from profile:", error);
      res.status(500).json({ error: "Failed to generate questions from profile" });
    }
  });

  // Extract text from PDF files
  app.post("/api/extract-pdf-text", upload.single('pdf'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No PDF file provided" });
      }

      // For now, return a message asking user to manually copy text
      // This avoids the PDF.js worker configuration complexity
      res.json({ 
        text: "PDF text extraction is currently unavailable. Please copy and paste your resume content into the LinkedIn summary field and use 'Ask from LinkedIn' instead.",
        fallback: true
      });
    } catch (error) {
      console.error("Error processing PDF:", error);
      res.status(500).json({ error: "Failed to process PDF file" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
