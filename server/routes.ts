import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import { GoogleGenerativeAI } from "@google/generative-ai";
import multer from "multer";
import * as admin from "firebase-admin";
import * as fs from 'fs';
import * as path from 'path';
import nodemailer from "nodemailer";
import * as pdfParse from "pdf-parse-new";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize Firebase Admin SDK
  let db: admin.firestore.Firestore;
  try {
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID || "ai-interview-platform"
      });
    }
    db = admin.firestore();
  } catch (error) {
    console.log("Firebase Admin not configured, questions will only be stored locally");
    db = null as any;
  }

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
      const { type, difficulty, roomId, jobContext } = req.body;
      
      if (!type || !difficulty) {
        return res.status(400).json({ error: "Type and difficulty are required" });
      }

      if (!process.env.GOOGLE_GEMINI_API_KEY) {
        return res.status(500).json({ error: "Google Gemini API key not configured" });
      }

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      let prompt = "";
      
      if (jobContext) {
        prompt = `Generate a ${difficulty} ${type} interview question for a ${jobContext.seniorityLevel} ${jobContext.jobTitle} who will work with ${jobContext.techStack}. Focus the question on realistic skills they'll use on the job.

Job Context:
- Position: ${jobContext.jobTitle}
- Level: ${jobContext.seniorityLevel}
- Tech Stack: ${jobContext.techStack}
- Role Type: ${jobContext.roleType}

Requirements:
- Use plain text formatting without markdown symbols like ** or ##
- Keep formatting clean and readable without special characters
- Use simple numbering (1., 2., 3.) for lists
- Use bullet points with - for sub-items
- Practical and relevant to real-world scenarios specific to their role
- Focus on technologies and challenges they'll actually encounter

`;
      } else {
        prompt = `Generate a clean, well-formatted ${type} interview question for a frontend developer at ${difficulty} level.

Requirements:
- Use plain text formatting without markdown symbols like ** or ##
- Keep formatting clean and readable without special characters
- Use simple numbering (1., 2., 3.) for lists
- Use bullet points with - for sub-items
- Practical and relevant to real-world scenarios

`;
      }

      if (type === "Coding") {
        prompt += `For coding questions:
- Include clear problem description and requirements
- Specify expected functionality and constraints
- Mention any specific technologies or patterns to use
- Include example data if helpful`;
      } else if (type === "Algorithm") {
        prompt += `For algorithm questions:
- Focus on algorithmic thinking and problem-solving
- Include time and space complexity considerations
- Present data structure optimization challenges
- Ask about trade-offs between different approaches`;
      } else if (type === "System Design") {
        prompt += `For system design questions:
- Focus on scalability, architecture, and design patterns
- Include considerations for performance and reliability
- Ask about technology choices and trade-offs
- Cover both high-level and detailed implementation aspects`;
      } else if (type === "Data Structures") {
        prompt += `For data structure questions:
- Focus on choosing appropriate data structures
- Include performance implications and use cases
- Ask about implementation details and optimizations
- Cover both theoretical knowledge and practical applications`;
      } else if (type === "Behavioral") {
        prompt += `For behavioral questions:
- Focus on past experiences and situations
- Ask about teamwork, problem-solving, or conflict resolution
- Use STAR method framework (Situation, Task, Action, Result)
- Relate to software development scenarios and team dynamics`;
      } else if (type === "Psychometric") {
        prompt += `For psychometric questions:
- Focus on personality traits, work style, and motivations
- Ask about handling stress, communication preferences, and decision-making
- Include scenarios about adaptability and learning approaches
- Explore values, career goals, and cultural fit aspects`;
      } else if (type === "Situational") {
        prompt += `For situational questions:
- Present hypothetical scenarios in software development
- Focus on decision-making and problem-solving approach
- Include technical trade-offs or team dynamics
- Ask how they would handle specific challenges and conflicts`;
      } else if (type === "Technical Knowledge") {
        prompt += `For technical knowledge questions:
- Focus on theoretical understanding and best practices
- Ask about specific technologies, frameworks, or methodologies
- Include questions about industry standards and patterns
- Test depth of knowledge in relevant technical areas`;
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
        
        const prompt = `Based on this LinkedIn profile data, generate exactly 2 concise interview questions:

${profileText}

REQUIREMENTS:
- Generate exactly 2 questions
- Keep each question under 25 words for better readability
- Focus on their professional experience, skills, and career progression
- Make questions specific to their background, not generic
- Questions should be direct and actionable
- Use plain text formatting without markdown symbols
- Separate the two questions with a blank line
- Do not number the questions

Format: Present each question as a concise, direct interview question.`;
        
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
          
          // Also update Firestore for real-time sync
          if (db) {
            try {
              await db.collection('interviews').doc(roomId).set({
                question: combinedQuestions,
                questionType: 'LinkedIn Profile',
                difficulty: 'Medium',
                timestamp: Date.now()
              }, { merge: true });
            } catch (firestoreError) {
              console.error("Error updating Firestore:", firestoreError);
            }
          }
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
        
        const prompt = `Based on this developer's GitHub profile and repositories, generate exactly 2 concise interview questions:

${fullProfileText}

REQUIREMENTS:
- Generate exactly 2 questions
- Keep each question under 25 words for better readability
- Focus on their coding experience, project choices, and technical skills
- Make questions specific to their repositories and background, not generic
- Questions should be direct and actionable
- Use plain text formatting without markdown symbols
- Separate the two questions with a blank line
- Do not number the questions

Format: Present each question as a concise, direct interview question.`;
        
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
          
          // Also update Firestore for real-time sync
          if (db) {
            try {
              await db.collection('interviews').doc(roomId).set({
                question: combinedQuestions,
                questionType: 'GitHub Profile',
                difficulty: 'Medium',
                timestamp: Date.now()
              }, { merge: true });
            } catch (firestoreError) {
              console.error("Error updating Firestore:", firestoreError);
            }
          }
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

      // Extract text from PDF using pdf-parse-new
      try {
        const pdfParse = (await import('pdf-parse-new')).default;
        const pdfData = await pdfParse(file.buffer);
        const resumeText = pdfData.text.trim();

        if (!resumeText.trim()) {
          throw new Error('Unable to extract text from PDF file');
        }

        // Generate questions using Gemini AI
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const prompt = `Generate exactly 2 concise interview questions based on this candidate's resume:

${resumeText}

REQUIREMENTS:
- Generate exactly 2 questions
- Keep each question under 25 words for better readability
- Focus on key experience, skills, or notable projects from the resume
- Make questions specific to their background, not generic
- Mix technical and behavioral questions based on their role
- Questions should be direct and actionable
- Use plain text formatting without markdown symbols
- Separate the two questions with a blank line
- Do not number the questions

Format: Present each question as a concise, direct interview question.`;
        
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
          
          // Also update Firestore for real-time sync
          if (db) {
            try {
              await db.collection('interviews').doc(roomId).set({
                question: combinedQuestions,
                questionType: 'Resume Analysis',
                difficulty: 'Medium',
                timestamp: Date.now()
              }, { merge: true });
            } catch (firestoreError) {
              console.error("Error updating Firestore:", firestoreError);
            }
          }
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

  // Code analysis route for AI feedback
  app.post('/api/analyze-code', async (req, res) => {
    try {
      const { code, question } = req.body;

      if (!code || !question) {
        return res.status(400).json({ error: "Code and question are required" });
      }

      if (!process.env.GOOGLE_GEMINI_API_KEY) {
        return res.status(500).json({ error: "Google Gemini API key not configured" });
      }

      const prompt = `Here's the coding interview question:
---
${question}
---

And here is the candidate's response:
---
${code}
---

Evaluate the candidate's answer based on how well it solves the specific question. Provide structured feedback in JSON format.

Return the response as this exact JSON structure:
{
  "summary": "1-sentence summary of strengths/weaknesses",
  "scores": {
    "correctness": [score 1-10],
    "efficiency": [score 1-10], 
    "quality": [score 1-10],
    "readability": [score 1-10],
    "overall": [average score 1-10]
  },
  "fullExplanation": "Detailed 2-3 sentence explanation of the solution quality and specific improvements",
  "suggestion": "Optional 2-line suggestion to improve the answer"
}

Evaluation criteria:
- Correctness: Does the code correctly solve the specific problem stated in the question?
- Efficiency: Time and space complexity relative to optimal solutions
- Quality: Code structure, error handling, edge cases
- Readability: Clear variable names, comments, logical flow
- Overall: Weighted average considering the question's requirements

Be specific about how well the code addresses the original question requirements.`;

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse the JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Invalid response format");
      }

      const feedback = JSON.parse(jsonMatch[0]);
      
      // Ensure scores are numbers and within range
      const scores = feedback.scores;
      scores.quality = Math.max(1, Math.min(10, Math.round(scores.quality)));
      scores.correctness = Math.max(1, Math.min(10, Math.round(scores.correctness)));
      scores.efficiency = Math.max(1, Math.min(10, Math.round(scores.efficiency)));
      scores.readability = Math.max(1, Math.min(10, Math.round(scores.readability)));
      scores.overall = Math.round((scores.quality + scores.correctness + scores.efficiency + scores.readability) / 4 * 10) / 10;

      res.json(feedback);

    } catch (error) {
      console.error('Code analysis error:', error);
      res.status(500).json({ 
        error: "Failed to analyze code",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Export interview report endpoint
  app.post("/api/export-report", async (req, res) => {
    try {
      const { roomId, format, candidateName, candidateEmail, companyName } = req.body;
      
      if (!roomId || !format || !candidateName || !companyName) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Fetch interview data from Firestore
      let interviewData: any = {};
      let questionHistory: any[] = [];
      let jobContext: any = null;

      try {
        if (db) {
          // Get interview data
          const interviewDoc = await db.collection('interviews').doc(roomId).get();
          if (interviewDoc.exists) {
            interviewData = interviewDoc.data();
          }

          // Get question history
          const historySnapshot = await db.collection('interviews').doc(roomId).collection('history').orderBy('timestamp', 'desc').get();
          questionHistory = historySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          // Get job context
          const jobContextDoc = await db.collection('interviews').doc(roomId).collection('jobContext').doc('current').get();
          if (jobContextDoc.exists) {
            jobContext = jobContextDoc.data();
          }
        }
      } catch (firestoreError) {
        console.log("Firestore not available, using local data");
      }

      // Generate AI-powered overall summary
      if (!process.env.GOOGLE_GEMINI_API_KEY) {
        return res.status(500).json({ error: "Google Gemini API key not configured" });
      }

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const summaryPrompt = `As an expert technical interviewer, analyze this candidate's complete interview performance and provide a comprehensive 3-5 sentence summary.

Interview Details:
${jobContext ? `
Role: ${jobContext.jobTitle} (${jobContext.seniorityLevel} level)
Tech Stack: ${jobContext.techStack}
Interview Type: ${jobContext.roleType}
` : ''}

Questions and Responses:
${questionHistory.map((q, i) => `
Question ${i + 1} (${q.questionType || 'General'} - ${q.difficulty || 'Medium'}):
${q.question}

Candidate's Code:
${q.candidateCode || 'No code submitted'}

AI Feedback Score: ${q.aiFeedback?.scores?.overall || 'N/A'}/10
${q.aiFeedback?.summary || ''}
`).join('\n')}

Provide a professional summary that covers:
1. Overall technical competency
2. Problem-solving approach
3. Code quality and best practices
4. Communication and thought process
5. Final recommendation (Recommended/Not Recommended/Conditional)

Keep the tone professional and constructive.`;

      const summaryResult = await model.generateContent(summaryPrompt);
      const overallSummary = summaryResult.response.text();

      // Generate HTML report
      const reportHtml = generateReportHtml({
        candidateName,
        companyName,
        jobContext,
        questionHistory,
        overallSummary,
        interviewDate: new Date().toLocaleDateString()
      });

      if (format === 'pdf') {
        // For PDF generation, we'll return the HTML and let the frontend handle PDF conversion
        res.json({
          format: 'pdf',
          htmlContent: reportHtml,
          downloadUrl: `/api/download-report/${roomId}` // We'll implement this for direct PDF download
        });
      } else if (format === 'email') {
        // Send email with report
        await sendEmailReport(candidateEmail, candidateName, companyName, reportHtml);
        res.json({
          format: 'email',
          message: 'Report sent successfully'
        });
      }

    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}

// Helper function to generate HTML report
function generateReportHtml(data: {
  candidateName: string;
  companyName: string;
  jobContext: any;
  questionHistory: any[];
  overallSummary: string;
  interviewDate: string;
}) {
  const { candidateName, companyName, jobContext, questionHistory, overallSummary, interviewDate } = data;
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Interview Report - ${candidateName}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: white;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #4f46e5;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .company-name {
            font-size: 24px;
            font-weight: bold;
            color: #4f46e5;
            margin-bottom: 10px;
        }
        .report-title {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .candidate-info {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }
        .info-item {
            margin-bottom: 10px;
        }
        .label {
            font-weight: bold;
            color: #374151;
        }
        .value {
            color: #6b7280;
        }
        .summary-section {
            background: #ecfdf5;
            border-left: 4px solid #10b981;
            padding: 20px;
            margin-bottom: 30px;
        }
        .summary-title {
            font-size: 20px;
            font-weight: bold;
            color: #065f46;
            margin-bottom: 15px;
        }
        .question-section {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            margin-bottom: 25px;
            overflow: hidden;
        }
        .question-header {
            background: #f3f4f6;
            padding: 15px;
            border-bottom: 1px solid #e5e7eb;
        }
        .question-title {
            font-size: 18px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 5px;
        }
        .question-meta {
            font-size: 14px;
            color: #6b7280;
        }
        .question-content {
            padding: 20px;
        }
        .question-text {
            background: #fafafa;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
            font-style: italic;
        }
        .code-section {
            margin-bottom: 20px;
        }
        .code-title {
            font-weight: bold;
            margin-bottom: 10px;
            color: #374151;
        }
        .code-block {
            background: #1f2937;
            color: #f9fafb;
            padding: 15px;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            overflow-x: auto;
            white-space: pre-wrap;
        }
        .feedback-section {
            background: #fff7ed;
            border: 1px solid #fed7aa;
            border-radius: 6px;
            padding: 15px;
        }
        .scores-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
            gap: 10px;
            margin-bottom: 15px;
        }
        .score-item {
            text-align: center;
            padding: 10px;
            background: white;
            border-radius: 4px;
            border: 1px solid #e5e7eb;
        }
        .score-label {
            font-size: 12px;
            color: #6b7280;
            margin-bottom: 5px;
        }
        .score-value {
            font-size: 18px;
            font-weight: bold;
            color: #1f2937;
        }
        .feedback-text {
            line-height: 1.6;
            color: #374151;
        }
        .final-recommendation {
            background: #f0f9ff;
            border: 2px solid #0ea5e9;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin-top: 30px;
        }
        .recommendation-title {
            font-size: 20px;
            font-weight: bold;
            color: #0c4a6e;
            margin-bottom: 10px;
        }
        @media print {
            body { margin: 0; padding: 15px; }
            .question-section { break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-name">${companyName}</div>
        <div class="report-title">Technical Interview Report</div>
        <div style="color: #6b7280; font-size: 16px;">Generated on ${interviewDate}</div>
    </div>

    <div class="candidate-info">
        <h2 style="margin-top: 0; color: #1f2937;">Candidate Information</h2>
        <div class="info-grid">
            <div class="info-item">
                <span class="label">Name:</span> <span class="value">${candidateName}</span>
            </div>
            ${jobContext ? `
            <div class="info-item">
                <span class="label">Position:</span> <span class="value">${jobContext.jobTitle}</span>
            </div>
            <div class="info-item">
                <span class="label">Level:</span> <span class="value">${jobContext.seniorityLevel}</span>
            </div>
            <div class="info-item">
                <span class="label">Tech Stack:</span> <span class="value">${jobContext.techStack}</span>
            </div>
            <div class="info-item">
                <span class="label">Interview Type:</span> <span class="value">${jobContext.roleType}</span>
            </div>
            ` : ''}
            <div class="info-item">
                <span class="label">Total Questions:</span> <span class="value">${questionHistory.length}</span>
            </div>
        </div>
    </div>

    <div class="summary-section">
        <div class="summary-title">Overall Performance Summary</div>
        <div>${overallSummary}</div>
    </div>

    <h2 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Question-by-Question Analysis</h2>

    ${questionHistory.map((question, index) => `
    <div class="question-section">
        <div class="question-header">
            <div class="question-title">Question ${index + 1}</div>
            <div class="question-meta">
                Type: ${question.questionType || 'General'} | 
                Difficulty: ${question.difficulty || 'Medium'} | 
                Timestamp: ${question.timestamp ? new Date(question.timestamp).toLocaleString() : 'N/A'}
            </div>
        </div>
        <div class="question-content">
            <div class="question-text">${question.question || 'No question text available'}</div>
            
            ${question.candidateCode ? `
            <div class="code-section">
                <div class="code-title">Candidate's Solution:</div>
                <div class="code-block">${question.candidateCode}</div>
            </div>
            ` : '<p style="color: #6b7280; font-style: italic;">No code solution provided</p>'}
            
            ${question.aiFeedback ? `
            <div class="feedback-section">
                <h4 style="margin-top: 0; color: #92400e;">AI Performance Analysis</h4>
                
                ${question.aiFeedback.scores ? `
                <div class="scores-grid">
                    <div class="score-item">
                        <div class="score-label">Correctness</div>
                        <div class="score-value">${question.aiFeedback.scores.correctness}/10</div>
                    </div>
                    <div class="score-item">
                        <div class="score-label">Efficiency</div>
                        <div class="score-value">${question.aiFeedback.scores.efficiency}/10</div>
                    </div>
                    <div class="score-item">
                        <div class="score-label">Quality</div>
                        <div class="score-value">${question.aiFeedback.scores.quality}/10</div>
                    </div>
                    <div class="score-item">
                        <div class="score-label">Readability</div>
                        <div class="score-value">${question.aiFeedback.scores.readability}/10</div>
                    </div>
                    <div class="score-item">
                        <div class="score-label">Overall</div>
                        <div class="score-value">${question.aiFeedback.scores.overall}/10</div>
                    </div>
                </div>
                ` : ''}
                
                <div class="feedback-text">
                    <strong>Summary:</strong> ${question.aiFeedback.summary || 'No feedback summary available'}
                </div>
                
                ${question.aiFeedback.fullExplanation ? `
                <div class="feedback-text" style="margin-top: 15px;">
                    <strong>Detailed Analysis:</strong> ${question.aiFeedback.fullExplanation}
                </div>
                ` : ''}
                
                ${question.aiFeedback.suggestion ? `
                <div class="feedback-text" style="margin-top: 15px;">
                    <strong>Improvement Suggestions:</strong> ${question.aiFeedback.suggestion}
                </div>
                ` : ''}
            </div>
            ` : '<p style="color: #6b7280; font-style: italic;">No AI feedback available</p>'}
        </div>
    </div>
    `).join('')}

    <div class="final-recommendation">
        <div class="recommendation-title">Interview Evaluation Complete</div>
        <p>This comprehensive report includes AI-powered analysis of the candidate's technical performance, problem-solving abilities, and code quality across all interview questions.</p>
    </div>
</body>
</html>`;
}

// Helper function to send email report
async function sendEmailReport(candidateEmail: string, candidateName: string, companyName: string, htmlContent: string) {
  if (!process.env.SENDGRID_API_KEY && !process.env.SMTP_HOST) {
    throw new Error("Email service not configured");
  }

  // Use nodemailer with SMTP or SendGrid
  let transporter;
  
  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  } else {
    // Fallback to basic SMTP configuration
    transporter = nodemailer.createTransport({
      service: 'gmail', // This can be configured
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || `interviews@${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
    to: candidateEmail,
    subject: `Interview Report - ${candidateName} | ${companyName}`,
    html: htmlContent,
    text: `Dear ${candidateName},\n\nPlease find your interview report attached. Thank you for your time and participation in our interview process.\n\nBest regards,\n${companyName} Hiring Team`
  };

  await transporter.sendMail(mailOptions);
}
