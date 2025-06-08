import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import { GoogleGenerativeAI } from "@google/generative-ai";
import multer from "multer";
import * as fs from 'fs';
import * as path from 'path';

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

      // For reliable PDF processing, guide users to use the LinkedIn summary field
      console.log(`Received PDF file: ${req.file.originalname}, size: ${req.file.size} bytes`);
      
      res.json({ 
        text: `I see you've uploaded a PDF resume (${req.file.originalname}). For the most accurate question generation, please copy the text content from your resume and paste it into the LinkedIn summary field above, then click "Ask from LinkedIn". This ensures I can properly analyze your background and generate relevant interview questions.`,
        fallback: true
      });
    } catch (error) {
      console.error("Error processing PDF:", error);
      res.status(500).json({ error: "Failed to process PDF file" });
    }
  });

  // Generate questions from LinkedIn profile using Proxycurl API
  app.post("/api/gen-from-linkedin", async (req, res) => {
    try {
      const { url, roomId } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: "LinkedIn URL is required" });
      }

      if (!process.env.PROXYCURL_API_KEY) {
        return res.status(500).json({ error: "Proxycurl API key not configured" });
      }

      if (!process.env.GOOGLE_GEMINI_API_KEY) {
        return res.status(500).json({ error: "Google Gemini API key not configured" });
      }

      // Fetch LinkedIn profile data using Proxycurl API
      try {
        const proxycurlUrl = new URL('https://nubela.co/proxycurl/api/v2/linkedin');
        proxycurlUrl.searchParams.append('url', url);
        
        const proxycurlResponse = await fetch(proxycurlUrl.toString(), {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.PROXYCURL_API_KEY}`,
          },
        });

        if (!proxycurlResponse.ok) {
          throw new Error(`Proxycurl API error: ${proxycurlResponse.status}`);
        }

        const profileData = await proxycurlResponse.json();
        
        // Extract relevant profile information
        const profileText = [
          profileData.full_name ? `Name: ${profileData.full_name}` : '',
          profileData.headline ? `Headline: ${profileData.headline}` : '',
          profileData.summary ? `Summary: ${profileData.summary}` : '',
          profileData.occupation ? `Current Role: ${profileData.occupation}` : '',
          profileData.skills && profileData.skills.length > 0 ? `Skills: ${profileData.skills.join(', ')}` : '',
          profileData.experiences && profileData.experiences.length > 0 ? 
            `Recent Experience: ${profileData.experiences.slice(0, 3).map((exp: any) => 
              `${exp.title} at ${exp.company}${exp.description ? ' - ' + exp.description.substring(0, 200) : ''}`
            ).join('; ')}` : '',
        ].filter((item: string) => item.length > 0).join('\n\n');

        if (!profileText.trim()) {
          throw new Error('Unable to extract profile information from LinkedIn');
        }

        // Generate questions using Gemini AI
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const prompt = `Generate exactly 2 thoughtful interview questions for a candidate with this LinkedIn profile:

${profileText}

REQUIREMENTS:
- Generate exactly 2 questions
- Focus on their professional experience, skills, and career progression
- Make questions specific to their background, not generic
- Each question should be substantial and thought-provoking
- Questions should be appropriate for a technical interview
- Use plain text formatting without markdown symbols like ** or ##
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
          console.log(`Storing LinkedIn-based questions for room ${roomId}:`, combinedQuestions.substring(0, 100) + "...");
          await storage.setRoomQuestion(roomId, combinedQuestions);
        }

        res.json({ questions });

      } catch (apiError) {
        console.error("LinkedIn profile fetching error:", apiError);
        res.status(500).json({ 
          error: "Failed to fetch LinkedIn profile data. Please check the URL and try again." 
        });
      }

    } catch (error) {
      console.error("Error generating questions from LinkedIn:", error);
      res.status(500).json({ error: "Failed to generate questions from LinkedIn profile" });
    }
  });

  // Generate questions from GitHub profile using GitHub API
  app.post("/api/gen-from-github", async (req, res) => {
    try {
      const { username, roomId } = req.body;
      
      if (!username) {
        return res.status(400).json({ error: "GitHub username is required" });
      }

      if (!process.env.GOOGLE_GEMINI_API_KEY) {
        return res.status(500).json({ error: "Google Gemini API key not configured" });
      }

      // Fetch GitHub profile data using GitHub API
      try {
        // Get user profile
        const profileResponse = await fetch(`https://api.github.com/users/${username}`);
        
        if (!profileResponse.ok) {
          if (profileResponse.status === 404) {
            throw new Error(`GitHub user '${username}' not found`);
          }
          throw new Error(`GitHub API error: ${profileResponse.status}`);
        }

        const profileData = await profileResponse.json();
        
        // Get top repositories
        const reposResponse = await fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=3`);
        let reposData = [];
        
        if (reposResponse.ok) {
          reposData = await reposResponse.json();
        }
        
        // Extract relevant profile information
        const profileText = [
          profileData.name ? `Name: ${profileData.name}` : '',
          profileData.login ? `Username: ${profileData.login}` : '',
          profileData.bio ? `Bio: ${profileData.bio}` : '',
          profileData.company ? `Company: ${profileData.company}` : '',
          profileData.location ? `Location: ${profileData.location}` : '',
          profileData.public_repos ? `Public Repositories: ${profileData.public_repos}` : '',
          profileData.followers ? `Followers: ${profileData.followers}` : '',
          profileData.following ? `Following: ${profileData.following}` : '',
        ].filter((item: string) => item.length > 0).join('\n');

        // Add repository information
        let repoText = '';
        if (reposData.length > 0) {
          repoText = '\nTop Recent Repositories:\n' + reposData.map((repo: any) => 
            `- ${repo.name}${repo.description ? ': ' + repo.description : ''}${repo.language ? ' (Language: ' + repo.language + ')' : ''}${repo.stargazers_count ? ' - ' + repo.stargazers_count + ' stars' : ''}`
          ).join('\n');
        }

        const fullProfileText = profileText + repoText;

        if (!fullProfileText.trim()) {
          throw new Error('Unable to extract profile information from GitHub');
        }

        // Generate questions using Gemini AI
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const prompt = `Based on this developer's GitHub profile and public repositories, generate exactly 2 relevant interview questions:

${fullProfileText}

REQUIREMENTS:
- Generate exactly 2 questions
- Focus on their coding experience, project choices, and technical skills
- Make questions specific to their repositories and background, not generic
- Each question should be substantial and thought-provoking
- Questions should be appropriate for a technical interview
- Use plain text formatting without markdown symbols like ** or ##
- Separate the two questions with a blank line
- Do not number the questions

Format: Present each question as a complete, professional interview question that an interviewer would naturally ask.`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const generatedText = response.text();

        // Split the response into individual questions
        const questions = generatedText
          .split('\n\n')
          .filter((q: string) => q.trim().length > 0)
          .map((q: string) => q.trim());

        // Store the combined questions for the room if roomId is provided
        if (roomId && questions.length > 0) {
          const combinedQuestions = questions.join('\n\n');
          console.log(`Storing GitHub-based questions for room ${roomId}:`, combinedQuestions.substring(0, 100) + "...");
          await storage.setRoomQuestion(roomId, combinedQuestions);
        }

        res.json({ questions });

      } catch (apiError) {
        console.error("GitHub profile fetching error:", apiError);
        res.status(500).json({ 
          error: "Failed to fetch GitHub profile data. Please check the username and try again." 
        });
      }

    } catch (error) {
      console.error("Error generating questions from GitHub:", error);
      res.status(500).json({ error: "Failed to generate questions from GitHub profile" });
    }
  });

  // Generate questions from resume PDF using pdf-parse
  app.post("/api/gen-from-resume", upload.single('resume'), async (req, res) => {
    try {
      const { roomId } = req.body;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ error: "Resume file is required" });
      }

      if (!process.env.GOOGLE_GEMINI_API_KEY) {
        return res.status(500).json({ error: "Google Gemini API key not configured" });
      }

      // Extract text from PDF using pdfjs-dist
      try {
        const pdfjs = await import('pdfjs-dist');
        
        // Load PDF document from buffer
        const loadingTask = pdfjs.getDocument({ data: file.buffer });
        const pdfDoc = await loadingTask.promise;
        
        let resumeText = '';
        
        // Extract text from all pages
        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          const page = await pdfDoc.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          // Combine text items with spaces
          const pageText = textContent.items
            .map((item: any) => item.str || '')
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          if (pageText) {
            resumeText += pageText + '\n\n';
          }
        }
        
        resumeText = resumeText.trim();

        if (!resumeText.trim()) {
          throw new Error('Unable to extract text from PDF file');
        }

        // Generate questions using Gemini AI
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const prompt = `Generate exactly 2 technical or behavioral interview questions based on this candidate's resume:

${resumeText}

REQUIREMENTS:
- Generate exactly 2 questions
- Focus on their experience, skills, projects, and career progression shown in the resume
- Make questions specific to their background, not generic
- Mix technical and behavioral questions based on their role and experience
- Each question should be substantial and thought-provoking
- Questions should be appropriate for a professional interview
- Use plain text formatting without markdown symbols like ** or ##
- Separate the two questions with a blank line
- Do not number the questions

Format: Present each question as a complete, professional interview question that an interviewer would naturally ask.`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const generatedText = response.text();

        // Split the response into individual questions
        const questions = generatedText
          .split('\n\n')
          .filter((q: string) => q.trim().length > 0)
          .map((q: string) => q.trim());

        // Store the combined questions for the room if roomId is provided
        if (roomId && questions.length > 0) {
          const combinedQuestions = questions.join('\n\n');
          console.log(`Storing resume-based questions for room ${roomId}:`, combinedQuestions.substring(0, 100) + "...");
          await storage.setRoomQuestion(roomId, combinedQuestions);
        }

        res.json({ questions });

      } catch (pdfError) {
        console.error("PDF processing error:", pdfError);
        res.status(500).json({ 
          error: "Failed to process PDF file. Please ensure the file is a valid PDF with readable text." 
        });
      }

    } catch (error) {
      console.error("Error generating questions from resume:", error);
      res.status(500).json({ error: "Failed to generate questions from resume" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
