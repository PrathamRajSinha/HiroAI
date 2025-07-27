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

  // Helper function to add questions to timeline
  const addQuestionToTimeline = async (roomId: string, questionData: {
    question: string;
    questionType: string;
    difficulty: string;
    status?: 'not_sent' | 'sent' | 'answered' | 'evaluated';
  }) => {
    if (!db) return;
    
    try {
      const questionsRef = db.collection('interviews').doc(roomId).collection('questions');
      await questionsRef.add({
        ...questionData,
        status: questionData.status || 'not_sent',
        timestamp: Date.now(),
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error adding question to timeline:', error);
    }
  };

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
      const { type, difficulty, roomId, jobContext, topic } = req.body;
      
      if (!type || !difficulty) {
        return res.status(400).json({ error: "Type and difficulty are required" });
      }

      if (!process.env.GOOGLE_GEMINI_API_KEY) {
        return res.status(500).json({ error: "Google Gemini API key not configured" });
      }

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      let prompt = "";
      
      // Create topic-specific prompt prefix if topic is provided
      let topicPrefix = "";
      if (topic && topic.trim()) {
        topicPrefix = `specifically focused on: ${topic.trim()}. `;
      }
      
      if (jobContext) {
        prompt = `Generate a ${difficulty} ${type} interview question ${topicPrefix}for a ${jobContext.seniorityLevel} ${jobContext.jobTitle} who will work with ${jobContext.techStack}. Focus the question on realistic skills they'll use on the job.

Job Context:
- Position: ${jobContext.jobTitle}
- Level: ${jobContext.seniorityLevel}
- Tech Stack: ${jobContext.techStack}
- Role Type: ${jobContext.roleType}
${topic ? `- Specific Topic Focus: ${topic}` : ''}

Requirements:
- Use plain text formatting without markdown symbols like ** or ##
- Keep formatting clean and readable without special characters
- Use simple numbering (1., 2., 3.) for lists
- Use bullet points with - for sub-items
- Practical and relevant to real-world scenarios specific to their role
- Focus on technologies and challenges they'll actually encounter
${topic ? `- Ensure the question directly relates to the specified topic: ${topic}` : ''}

`;
      } else {
        prompt = `Generate a clean, well-formatted ${difficulty} ${type} interview question ${topicPrefix}for a software developer.

Requirements:
- Use plain text formatting without markdown symbols like ** or ##
- Keep formatting clean and readable without special characters
- Use simple numbering (1., 2., 3.) for lists
- Use bullet points with - for sub-items
- Practical and relevant to real-world scenarios
${topic ? `- Ensure the question directly relates to the specified topic: ${topic}` : ''}

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
        
        // Add to timeline
        await addQuestionToTimeline(roomId, {
          question,
          questionType: type,
          difficulty,
          status: 'not_sent'
        });
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
          
          // Add to timeline
          await addQuestionToTimeline(roomId, {
            question: combinedQuestions,
            questionType: 'GitHub Profile',
            difficulty: 'Medium',
            status: 'not_sent'
          });
          
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
          
          // Add to timeline
          await addQuestionToTimeline(roomId, {
            question: combinedQuestions,
            questionType: 'Resume Analysis',
            difficulty: 'Medium',
            status: 'not_sent'
          });
          
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
    "relevance": [score 1-10],
    "efficiency": [score 1-10], 
    "quality": [score 1-10],
    "readability": [score 1-10],
    "overall": [weighted score 1-10]
  },
  "fullExplanation": "Detailed 2-3 sentence explanation of the solution quality and specific improvements",
  "suggestion": "Optional 2-line suggestion to improve the answer"
}

Evaluation criteria:
- Correctness: Does the code correctly solve the specific problem stated in the question?
- Relevance: How well does the solution address the actual question requirements and constraints?
- Efficiency: Time and space complexity relative to optimal solutions
- Quality: Code structure, error handling, edge cases
- Readability: Clear variable names, comments, logical flow
- Overall: Weighted score based on contextual importance (will be calculated automatically)

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
      
      // Add relevance score if not present (for backward compatibility)
      if (!scores.relevance) {
        scores.relevance = scores.correctness; // Use correctness as fallback for relevance
      }
      scores.relevance = Math.max(1, Math.min(10, Math.round(scores.relevance)));

      // Implement weighted scoring logic with contextual importance
      let overall;
      
      // If correctness or relevance < 3, cap overall at 3
      if (scores.correctness < 3 || scores.relevance < 3) {
        overall = Math.min(3, Math.max(scores.correctness, scores.relevance));
      } else {
        // Weighted average calculation
        const weights = {
          correctness: 0.30,   // 30%
          relevance: 0.30,     // 30%
          efficiency: 0.15,    // 15%
          readability: 0.15,   // 15%
          quality: 0.10        // 10%
        };
        
        overall = (
          scores.correctness * weights.correctness +
          scores.relevance * weights.relevance +
          scores.efficiency * weights.efficiency +
          scores.readability * weights.readability +
          scores.quality * weights.quality
        );
      }
      
      scores.overall = Math.round(overall * 10) / 10;

      // Generate AI note based on final score
      let scoreNote = "";
      if (scores.overall < 3) {
        scoreNote = "Poor understanding of question";
      } else if (scores.overall >= 3 && scores.overall < 5) {
        scoreNote = "Partial or misaligned answer";
      } else if (scores.overall >= 5 && scores.overall < 7) {
        scoreNote = "Acceptable with room for improvement";
      } else if (scores.overall >= 7) {
        scoreNote = "Strong answer with good alignment";
      }
      
      // Add the score note to the feedback
      feedback.scoreNote = scoreNote;

      res.json(feedback);

    } catch (error) {
      console.error('Code analysis error:', error);
      res.status(500).json({ 
        error: "Failed to analyze code",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Summarize transcript endpoint
  app.post("/api/summarize-transcript", async (req, res) => {
    try {
      const { transcript, question } = req.body;
      
      if (!transcript || !transcript.trim()) {
        return res.status(400).json({ error: "Transcript is required" });
      }

      if (!process.env.GOOGLE_GEMINI_API_KEY) {
        return res.status(500).json({ error: "Google Gemini API key not configured" });
      }

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      let prompt = `Please provide a comprehensive analysis of this candidate's spoken response during a technical interview:

INTERVIEW QUESTION:
${question || "No specific question provided"}

CANDIDATE'S SPOKEN RESPONSE:
${transcript}

Please provide:
1. A concise summary of their answer (2-3 sentences)
2. Key technical points mentioned
3. Communication clarity and structure
4. Areas of strength in their response
5. Areas that could be improved
6. Overall assessment of their verbal communication skills

Format your response as a structured analysis that would be helpful for interview evaluation.`;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const summary = response.text();

      res.json({ 
        summary,
        wordCount: transcript.split(' ').filter((word: string) => word.length > 0).length,
        analysisGenerated: new Date().toISOString()
      });

    } catch (error) {
      console.error('Transcript summarization error:', error);
      res.status(500).json({ 
        error: "Failed to summarize transcript",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Complete interview endpoint
  app.post("/api/complete-interview", async (req, res) => {
    try {
      const { roomId } = req.body;
      
      if (!roomId) {
        return res.status(400).json({ error: "Room ID is required" });
      }

      if (!process.env.GOOGLE_GEMINI_API_KEY) {
        return res.status(500).json({ error: "Google Gemini API key not configured" });
      }

      // Collect all interview data
      let interviewData: any = {};
      let questionHistory: any[] = [];
      let transcriptData: any[] = [];
      let codeAnalysis: any = null;
      let jobContext: any = null;

      if (db) {
        try {
          // Get main interview data
          const interviewDoc = await db.collection('interviews').doc(roomId).get();
          if (interviewDoc.exists) {
            interviewData = interviewDoc.data();
          }

          // Get question history
          const historySnapshot = await db.collection('interviews').doc(roomId).collection('history').orderBy('timestamp', 'desc').get();
          questionHistory = historySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          // Get transcript data
          const answersSnapshot = await db.collection('interviews').doc(roomId).collection('answers').get();
          transcriptData = answersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          // Get job context
          const jobContextDoc = await db.collection('interviews').doc(roomId).collection('jobContext').doc('current').get();
          if (jobContextDoc.exists) {
            jobContext = jobContextDoc.data();
          } else if (interviewData.jobContext) {
            jobContext = interviewData.jobContext;
          }

          // Get latest code analysis
          if (questionHistory.length > 0 && questionHistory[0].aiFeedback) {
            codeAnalysis = questionHistory[0].aiFeedback;
          }
        } catch (firestoreError) {
          console.error("Error fetching interview data:", firestoreError);
        }
      }

      // Generate comprehensive AI summary
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      let summaryPrompt = `As an expert technical interviewer, generate a comprehensive interview summary based on the following data:

INTERVIEW CONTEXT:
${jobContext ? `
Position: ${jobContext.jobTitle} (${jobContext.seniorityLevel} level)
Tech Stack: ${jobContext.techStack}
Role Type: ${jobContext.roleType}
` : 'No specific job context provided'}

QUESTIONS ASKED:
${questionHistory.length > 0 ? questionHistory.map((q, i) => `
${i + 1}. ${q.question || 'N/A'}
   Type: ${q.questionType || 'General'}
   Difficulty: ${q.difficulty || 'Medium'}
`).join('\n') : 'No questions recorded'}

CODE PERFORMANCE:
${codeAnalysis ? `
Overall Score: ${codeAnalysis.scores?.overall || 'N/A'}/10
Correctness: ${codeAnalysis.scores?.correctness || 'N/A'}/10
Efficiency: ${codeAnalysis.scores?.efficiency || 'N/A'}/10
Quality: ${codeAnalysis.scores?.quality || 'N/A'}/10
Readability: ${codeAnalysis.scores?.readability || 'N/A'}/10

AI Feedback: ${codeAnalysis.summary || 'No detailed feedback available'}
${codeAnalysis.fullExplanation ? `Analysis: ${codeAnalysis.fullExplanation}` : ''}
` : 'No code analysis available'}

VERBAL RESPONSES:
${transcriptData.length > 0 ? transcriptData.map((t, i) => `
Response ${i + 1}: ${t.transcript || 'No transcript'}
Word Count: ${t.wordCount || 0}
`).join('\n') : 'No verbal responses recorded'}

Please provide a structured summary covering:

1. **Overall Performance Assessment** (2-3 sentences)
2. **Technical Skills Evaluation** 
   - Code quality and problem-solving approach
   - Understanding of concepts and implementation
3. **Communication Skills**
   - Clarity and articulation during verbal responses
   - Ability to explain technical concepts
4. **Strengths Observed**
   - Key positive aspects demonstrated
5. **Areas for Improvement**
   - Specific gaps or weaknesses identified
6. **Recommendation Context**
   - Factors to consider for hiring decision

Keep the summary professional, objective, and actionable. Focus on specific observations rather than generic statements.`;

      const result = await model.generateContent(summaryPrompt);
      const response = await result.response;
      const summary = response.text();

      // Update interview status to completed
      if (db) {
        try {
          await db.collection('interviews').doc(roomId).update({
            status: 'completed',
            completedAt: Date.now(),
            preliminarySummary: summary
          });
        } catch (updateError) {
          console.error("Error updating interview status:", updateError);
        }
      }

      res.json({ 
        summary,
        interviewData: {
          questionCount: questionHistory.length,
          transcriptCount: transcriptData.length,
          hasCodeAnalysis: !!codeAnalysis,
          jobContext
        }
      });

    } catch (error) {
      console.error('Interview completion error:', error);
      res.status(500).json({ 
        error: "Failed to complete interview",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Submit interview feedback endpoint
  app.post("/api/submit-interview-feedback", async (req, res) => {
    try {
      const { roomId, interviewerNotes, finalDecision, aiSummary } = req.body;
      
      if (!roomId || !finalDecision) {
        return res.status(400).json({ error: "Room ID and final decision are required" });
      }

      const feedbackData = {
        status: 'completed',
        finalSummary: aiSummary,
        interviewerNotes: interviewerNotes || '',
        finalDecision,
        completedAt: Date.now(),
        completedBy: 'interviewer'
      };

      if (db) {
        try {
          // Save final summary and feedback
          await db.collection('interviews').doc(roomId).collection('finalSummary').doc('complete').set({
            ...feedbackData,
            timestamp: Date.now()
          });

          // Update main interview document
          await db.collection('interviews').doc(roomId).update({
            status: 'completed',
            finalDecision,
            completedAt: Date.now()
          });
        } catch (firestoreError) {
          console.error("Error saving interview feedback:", firestoreError);
          return res.status(500).json({ error: "Failed to save feedback to database" });
        }
      }

      res.json({ 
        success: true,
        message: "Interview completed and feedback saved successfully"
      });

    } catch (error) {
      console.error('Interview feedback error:', error);
      res.status(500).json({ 
        error: "Failed to save interview feedback",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Template management endpoints
  
  // Get all templates
  app.get("/api/templates", async (req, res) => {
    try {
      let templates: any[] = [];

      if (db) {
        try {
          const templatesSnapshot = await db.collection('interviewTemplates').orderBy('createdAt', 'desc').get();
          templates = templatesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (firestoreError) {
          console.error("Error fetching templates:", firestoreError);
        }
      }

      res.json(templates);
    } catch (error) {
      console.error('Templates fetch error:', error);
      res.status(500).json({ 
        error: "Failed to fetch templates",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Create new template
  app.post("/api/templates", async (req, res) => {
    try {
      const templateData = {
        ...req.body,
        id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        usageCount: 0
      };

      if (db) {
        try {
          await db.collection('interviewTemplates').doc(templateData.id).set(templateData);
        } catch (firestoreError) {
          console.error("Error creating template:", firestoreError);
          return res.status(500).json({ error: "Failed to save template to database" });
        }
      }

      res.json({ 
        success: true,
        template: templateData,
        message: "Template created successfully"
      });
    } catch (error) {
      console.error('Template creation error:', error);
      res.status(500).json({ 
        error: "Failed to create template",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Delete template
  app.delete("/api/templates/:templateId", async (req, res) => {
    try {
      const { templateId } = req.params;

      if (db) {
        try {
          await db.collection('interviewTemplates').doc(templateId).delete();
        } catch (firestoreError) {
          console.error("Error deleting template:", firestoreError);
          return res.status(500).json({ error: "Failed to delete template from database" });
        }
      }

      res.json({ 
        success: true,
        message: "Template deleted successfully"
      });
    } catch (error) {
      console.error('Template deletion error:', error);
      res.status(500).json({ 
        error: "Failed to delete template",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Record candidate consent
  app.post("/api/interviews/consent", async (req, res) => {
    try {
      const { roomId, consentGiven, timestamp } = req.body;
      
      if (!roomId) {
        return res.status(400).json({ error: "Room ID is required" });
      }

      const consentData = {
        consentGiven: consentGiven || false,
        timestamp: timestamp || Date.now(),
        ipAddress: req.ip || req.connection.remoteAddress
      };

      if (db) {
        await db.collection('interviews').doc(roomId).update({
          candidateConsent: consentData
        });
      }

      res.json({ 
        success: true,
        message: "Consent recorded successfully"
      });
    } catch (error) {
      console.error("Error recording consent:", error);
      res.status(500).json({ error: "Failed to record consent" });
    }
  });

  // Check consent status
  app.get("/api/interviews/:roomId/consent", async (req, res) => {
    try {
      const { roomId } = req.params;
      
      if (!roomId) {
        return res.status(400).json({ error: "Room ID is required" });
      }

      let consentGiven = false;

      if (db) {
        const doc = await db.collection('interviews').doc(roomId).get();
        if (doc.exists) {
          const data = doc.data();
          consentGiven = data?.candidateConsent?.consentGiven || false;
        }
      }

      res.json({ 
        consentGiven,
        roomId
      });
    } catch (error) {
      console.error("Error checking consent:", error);
      res.status(500).json({ error: "Failed to check consent status" });
    }
  });

  // Clone interview endpoint
  app.post("/api/clone-interview", async (req, res) => {
    try {
      const { interviewId, name, description } = req.body;
      
      if (!interviewId) {
        return res.status(400).json({ error: "Interview ID is required" });
      }

      let interviewData: any = null;
      let jobContext: any = null;

      if (db) {
        try {
          // Get interview data
          const interviewDoc = await db.collection('interviews').doc(interviewId).get();
          if (interviewDoc.exists) {
            interviewData = interviewDoc.data();
          }

          // Get job context
          const jobContextDoc = await db.collection('interviews').doc(interviewId).collection('jobContext').doc('current').get();
          if (jobContextDoc.exists) {
            jobContext = jobContextDoc.data();
          } else if (interviewData?.jobContext) {
            jobContext = interviewData.jobContext;
          }
        } catch (firestoreError) {
          console.error("Error fetching interview for cloning:", firestoreError);
          return res.status(500).json({ error: "Failed to fetch interview data" });
        }
      }

      if (!jobContext) {
        return res.status(404).json({ error: "Interview data not found or incomplete" });
      }

      // Create cloned template
      const clonedTemplate = {
        id: `clone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: name || `Cloned from ${jobContext.jobTitle}`,
        description: description || `Cloned from interview ${interviewId}`,
        jobTitle: jobContext.jobTitle || '',
        seniorityLevel: jobContext.seniorityLevel || 'Mid',
        roleType: jobContext.roleType || 'Fullstack',
        techStack: jobContext.techStack || '',
        department: jobContext.department || '',
        commonTopics: [],
        defaultQuestionType: interviewData?.questionType || 'Coding',
        defaultDifficulty: interviewData?.difficulty || 'Medium',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        usageCount: 0,
        isPublic: false,
        clonedFrom: interviewId
      };

      res.json({
        success: true,
        template: clonedTemplate,
        message: "Interview cloned successfully"
      });

    } catch (error) {
      console.error('Interview cloning error:', error);
      res.status(500).json({ 
        error: "Failed to clone interview",
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

      // Fetch interview data from Firestore or local storage
      let interviewData: any = {};
      let questionHistory: any[] = [];
      let jobContext: any = null;
      let latestCode: string | null = null;

      try {
        if (db) {
          console.log(`Fetching data for room: ${roomId}`);
          
          // Get interview data
          const interviewDoc = await db.collection('interviews').doc(roomId).get();
          if (interviewDoc.exists) {
            interviewData = interviewDoc.data();
            console.log("Interview data found:", interviewData);
          }

          // Get question history
          const historySnapshot = await db.collection('interviews').doc(roomId).collection('history').orderBy('timestamp', 'desc').get();
          questionHistory = historySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          console.log(`Found ${questionHistory.length} questions in history`);

          // Get job context
          const jobContextDoc = await db.collection('interviews').doc(roomId).collection('jobContext').doc('current').get();
          if (jobContextDoc.exists) {
            jobContext = jobContextDoc.data();
            console.log("Job context found:", jobContext);
          }

          // Fetch latest saved code from multiple possible locations
          try {
            // Try to get code from rounds collection
            const roundsSnapshot = await db.collection('interviews').doc(roomId).collection('rounds').orderBy('timestamp', 'desc').limit(1).get();
            if (!roundsSnapshot.empty) {
              const latestRound = roundsSnapshot.docs[0].data();
              if (latestRound.code && latestRound.code.trim()) {
                latestCode = latestRound.code;
                console.log("Found code in rounds collection");
              }
            }

            // If no code in rounds, try the main interview document
            if (!latestCode && interviewData.code && interviewData.code.trim()) {
              latestCode = interviewData.code;
              console.log("Found code in main interview document");
            }

            // If still no code, check if there's a code field in the latest question history
            if (!latestCode && questionHistory.length > 0) {
              const latestQuestion = questionHistory[0];
              if (latestQuestion.candidateCode && latestQuestion.candidateCode.trim()) {
                latestCode = latestQuestion.candidateCode;
                console.log("Found code in latest question history");
              }
            }

          } catch (codeError) {
            console.log("Error fetching code:", codeError);
          }
        }
      } catch (firestoreError) {
        console.log("Firestore error:", firestoreError);
        console.log("Firestore not available, using local data");
      }

      // If no data from Firestore, get the current room question from local storage
      if (questionHistory.length === 0) {
        console.log("No history found in Firestore, checking current room data");
        
        // Get current question from room storage
        const currentQuestion = await storage.getRoomQuestion(roomId);
        if (currentQuestion && currentQuestion.trim()) {
          questionHistory = [{
            id: 'current',
            question: currentQuestion,
            questionType: 'Generated',
            difficulty: 'Medium',
            timestamp: Date.now(),
            candidateCode: 'No code submitted',
            aiFeedback: null
          }];
          console.log("Added current room question to history for report");
        }
      }

      // If we found latest code, analyze it with AI scoring
      let latestCodeAnalysis: any = null;
      if (latestCode && latestCode.trim() && latestCode !== 'No code submitted') {
        try {
          // Get the current question for context
          const currentQuestion = questionHistory.length > 0 ? questionHistory[0].question : 
                                 (interviewData.question || 'Analyze this code solution');

          console.log("Analyzing latest code with AI...");
          
          const codePrompt = `Here's the coding interview question:
---
${currentQuestion}
---

And here is the candidate's response:
---
${latestCode}
---

Evaluate the candidate's answer based on how well it solves the specific question. Provide structured feedback in JSON format.

Return the response as this exact JSON structure:
{
  "summary": "1-sentence summary of strengths/weaknesses",
  "scores": {
    "correctness": [score 1-10],
    "relevance": [score 1-10],
    "efficiency": [score 1-10], 
    "quality": [score 1-10],
    "readability": [score 1-10],
    "overall": [weighted score 1-10]
  },
  "fullExplanation": "Detailed 2-3 sentence explanation of the solution quality and specific improvements",
  "suggestion": "Optional 2-line suggestion to improve the answer"
}

Evaluation criteria:
- Correctness: Does the code correctly solve the specific problem stated in the question?
- Relevance: How well does the solution address the actual question requirements and constraints?
- Efficiency: Time and space complexity relative to optimal solutions
- Quality: Code structure, error handling, edge cases
- Readability: Clear variable names, comments, logical flow
- Overall: Weighted score based on contextual importance (will be calculated automatically)

Be specific about how well the code addresses the original question requirements.`;

          const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          const result = await model.generateContent(codePrompt);
          const response = await result.response;
          const text = response.text();

          // Parse the JSON response
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const feedback = JSON.parse(jsonMatch[0]);
            
            // Apply weighted scoring logic
            const scores = feedback.scores;
            scores.quality = Math.max(1, Math.min(10, Math.round(scores.quality)));
            scores.correctness = Math.max(1, Math.min(10, Math.round(scores.correctness)));
            scores.efficiency = Math.max(1, Math.min(10, Math.round(scores.efficiency)));
            scores.readability = Math.max(1, Math.min(10, Math.round(scores.readability)));
            
            if (!scores.relevance) {
              scores.relevance = scores.correctness;
            }
            scores.relevance = Math.max(1, Math.min(10, Math.round(scores.relevance)));

            // Implement weighted scoring logic
            let overall;
            if (scores.correctness < 3 || scores.relevance < 3) {
              overall = Math.min(3, Math.max(scores.correctness, scores.relevance));
            } else {
              const weights = {
                correctness: 0.30,
                relevance: 0.30,
                efficiency: 0.15,
                readability: 0.15,
                quality: 0.10
              };
              
              overall = (
                scores.correctness * weights.correctness +
                scores.relevance * weights.relevance +
                scores.efficiency * weights.efficiency +
                scores.readability * weights.readability +
                scores.quality * weights.quality
              );
            }
            
            scores.overall = Math.round(overall * 10) / 10;

            // Generate score note
            let scoreNote = "";
            if (scores.overall < 3) {
              scoreNote = "Poor understanding of question";
            } else if (scores.overall >= 3 && scores.overall < 5) {
              scoreNote = "Partial or misaligned answer";
            } else if (scores.overall >= 5 && scores.overall < 7) {
              scoreNote = "Acceptable with room for improvement";
            } else if (scores.overall >= 7) {
              scoreNote = "Strong answer with good alignment";
            }
            
            feedback.scoreNote = scoreNote;
            latestCodeAnalysis = feedback;
            console.log("Latest code analysis completed");
          }
        } catch (analysisError) {
          console.log("Error analyzing latest code:", analysisError);
        }
      }

      // Generate AI-powered overall summary
      if (!process.env.GOOGLE_GEMINI_API_KEY) {
        return res.status(500).json({ error: "Google Gemini API key not configured" });
      }

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      let summaryPrompt;
      
      if (questionHistory.length === 0) {
        summaryPrompt = `Generate a brief professional summary indicating that this interview report was generated but no completed questions or responses were found for analysis. 

Interview Context:
${jobContext ? `Position: ${jobContext.jobTitle} (${jobContext.seniorityLevel} level)` : 'No position context available'}

State that the interview may be in progress or the questions haven't been submitted yet. Keep it professional and neutral.`;
      } else {
        summaryPrompt = `As an expert technical interviewer, analyze this candidate's interview performance and provide a comprehensive 3-5 sentence summary.

Interview Details:
${jobContext ? `
Role: ${jobContext.jobTitle} (${jobContext.seniorityLevel} level)
Tech Stack: ${jobContext.techStack}
Interview Type: ${jobContext.roleType}
` : 'Position: General Technical Interview'}

Questions and Responses (${questionHistory.length} total):
${questionHistory.map((q, i) => `
Question ${i + 1} (${q.questionType || 'General'} - ${q.difficulty || 'Medium'}):
${q.question}

Candidate's Response:
${q.candidateCode || 'No code submitted'}

${q.aiFeedback ? `AI Analysis: ${q.aiFeedback.summary || 'Feedback pending'}
Overall Score: ${q.aiFeedback.scores?.overall || 'N/A'}/10` : 'AI feedback not yet available'}
`).join('\n')}

Provide a professional summary covering:
1. Overall technical competency based on available responses
2. Problem-solving approach demonstrated
3. Code quality and best practices (if code was submitted)
4. Final assessment recommendation

Keep the tone professional and constructive. If limited data is available, acknowledge this in the summary.`;
      }

      const summaryResult = await model.generateContent(summaryPrompt);
      const overallSummary = summaryResult.response.text();

      // Generate HTML report
      const reportHtml = generateReportHtml({
        candidateName,
        companyName,
        jobContext,
        questionHistory,
        overallSummary,
        interviewDate: new Date().toLocaleDateString(),
        latestCode,
        latestCodeAnalysis
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

  // Dashboard API endpoints
  
  // Get all interviews for dashboard
  app.get("/api/interviews", async (req, res) => {
    try {
      let interviews: any[] = [];

      if (db) {
        const interviewsSnapshot = await db.collection('interviews').orderBy('timestamp', 'desc').get();
        interviews = interviewsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            candidateName: data.candidateName || 'Unknown Candidate',
            candidateId: data.candidateId || doc.id,
            roleTitle: data.roleTitle || 'Software Engineer',
            roundNumber: data.roundNumber || 1,
            interviewerName: data.interviewerName || 'Unknown Interviewer',
            date: data.timestamp ? new Date(data.timestamp).toLocaleDateString() : new Date().toLocaleDateString(),
            timestamp: data.timestamp || Date.now(),
            status: data.status || 'In Progress',
            jobContext: data.jobContext,
            summary: data.summary,
            overallScore: data.overallScore
          };
        });
      } else {
        // Fallback for when Firebase is not available
        console.log("Firebase not available, returning empty interviews list");
      }

      res.json({ interviews });
    } catch (error) {
      console.error("Error fetching interviews:", error);
      res.status(500).json({ error: "Failed to fetch interviews" });
    }
  });

  // Create new interview session
  app.post("/api/interviews", async (req, res) => {
    try {
      const { 
        candidateName, 
        roleTitle, 
        interviewerName, 
        jobTitle, 
        seniorityLevel, 
        techStack, 
        roleType,
        department,
        defaultQuestionType,
        defaultDifficulty
      } = req.body;
      
      if (!candidateName || !jobTitle || !interviewerName) {
        return res.status(400).json({ error: "Missing required fields: candidateName, jobTitle, and interviewerName" });
      }

      const roomId = Math.random().toString(36).substring(2, 10);
      const candidateId = `candidate_${Math.random().toString(36).substring(2, 10)}`;
      
      const interviewData = {
        candidateName,
        candidateId,
        roleTitle: jobTitle, // Use jobTitle as roleTitle for consistency
        roundNumber: 1,
        interviewerName,
        timestamp: Date.now(),
        status: 'Scheduled',
        jobContext: {
          jobTitle: jobTitle,
          seniorityLevel: seniorityLevel || 'Mid',
          techStack: techStack || 'General',
          roleType: roleType || 'Full Stack',
          department: department || 'Engineering'
        },
        questionPreferences: {
          defaultQuestionType: defaultQuestionType || 'Coding',
          defaultDifficulty: defaultDifficulty || 'Medium'
        }
      };

      if (db) {
        await db.collection('interviews').doc(roomId).set(interviewData);
        
        // Also set job context in the room's subcollection
        await db.collection('interviews').doc(roomId).collection('jobContext').doc('current').set({
          ...interviewData.jobContext,
          questionPreferences: interviewData.questionPreferences
        });
      }

      res.json({ 
        roomId,
        interviewId: roomId,
        ...interviewData
      });
    } catch (error) {
      console.error("Error creating interview:", error);
      res.status(500).json({ error: "Failed to create interview" });
    }
  });

  // Get interview review data
  app.get("/api/interviews/:id/review", async (req, res) => {
    try {
      const { id } = req.params;
      let reviewData: any = null;

      if (db) {
        // Get main interview document
        const interviewDoc = await db.collection('interviews').doc(id).get();
        if (!interviewDoc.exists) {
          return res.status(404).json({ error: "Interview not found" });
        }

        const interviewData = interviewDoc.data();
        
        // Get question history
        const historySnapshot = await db.collection('interviews').doc(id).collection('history').orderBy('timestamp', 'desc').get();
        const questions = historySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Get job context
        const jobContextDoc = await db.collection('interviews').doc(id).collection('jobContext').doc('current').get();
        const jobContext = jobContextDoc.exists ? jobContextDoc.data() : null;

        // Get candidate profile data (if available)
        const profileDoc = await db.collection('interviews').doc(id).collection('profile').doc('data').get();
        const candidateProfile = profileDoc.exists ? profileDoc.data() : null;

        // Create rounds history (for now, just current round)
        const rounds = [{
          roundNumber: interviewData?.roundNumber || 1,
          date: interviewData?.timestamp ? new Date(interviewData.timestamp).toLocaleDateString() : new Date().toLocaleDateString(),
          status: interviewData?.status || 'In Progress',
          questionsCount: questions.length,
          averageScore: questions.length > 0 && (questions[0] as any).aiFeedback ? (questions[0] as any).aiFeedback.scores?.overall : null,
          verdict: interviewData?.verdict
        }];

        reviewData = {
          id,
          candidateName: interviewData?.candidateName || 'Unknown Candidate',
          candidateId: interviewData?.candidateId || id,
          roleTitle: interviewData?.roleTitle || 'Software Engineer',
          roundNumber: interviewData?.roundNumber || 1,
          interviewerName: interviewData?.interviewerName || 'Unknown Interviewer',
          timestamp: interviewData?.timestamp || Date.now(),
          status: interviewData?.status || 'In Progress',
          jobContext: jobContext || {
            jobTitle: 'Software Engineer',
            seniorityLevel: 'Mid',
            techStack: 'General',
            roleType: 'Coding'
          },
          questions,
          candidateProfile,
          rounds,
          overallSummary: interviewData?.summary,
          manualNotes: interviewData?.manualNotes
        };
      }

      if (!reviewData) {
        return res.status(404).json({ error: "Interview not found" });
      }

      res.json(reviewData);
    } catch (error) {
      console.error("Error fetching interview review:", error);
      res.status(500).json({ error: "Failed to fetch interview review" });
    }
  });

  // Save manual notes
  app.put("/api/interviews/:id/notes", async (req, res) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;

      if (db) {
        await db.collection('interviews').doc(id).update({
          manualNotes: notes,
          notesUpdated: Date.now()
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error saving notes:", error);
      res.status(500).json({ error: "Failed to save notes" });
    }
  });

  // Create next round
  app.post("/api/interviews/next-round", async (req, res) => {
    try {
      const { interviewId, candidateId } = req.body;
      
      if (!interviewId || !candidateId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      let previousInterview: any = null;

      if (db) {
        const prevDoc = await db.collection('interviews').doc(interviewId).get();
        if (prevDoc.exists) {
          previousInterview = prevDoc.data();
        }
      }

      if (!previousInterview) {
        return res.status(404).json({ error: "Previous interview not found" });
      }

      // Create new room for next round
      const newRoomId = Math.random().toString(36).substring(2, 10);
      
      const nextRoundData = {
        candidateName: previousInterview.candidateName,
        candidateId: candidateId,
        roleTitle: previousInterview.roleTitle,
        roundNumber: (previousInterview.roundNumber || 1) + 1,
        interviewerName: previousInterview.interviewerName,
        timestamp: Date.now(),
        status: 'Scheduled',
        jobContext: previousInterview.jobContext,
        previousRound: interviewId
      };

      if (db) {
        await db.collection('interviews').doc(newRoomId).set(nextRoundData);
        
        // Set job context for new round
        if (nextRoundData.jobContext) {
          await db.collection('interviews').doc(newRoomId).collection('jobContext').doc('current').set(nextRoundData.jobContext);
        }
      }

      res.json({ 
        roomId: newRoomId,
        interviewId: newRoomId,
        ...nextRoundData
      });
    } catch (error) {
      console.error("Error creating next round:", error);
      res.status(500).json({ error: "Failed to create next round" });
    }
  });

  // Generate suggestions for next round
  app.post("/api/interviews/:id/suggestions", async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!process.env.GOOGLE_GEMINI_API_KEY) {
        return res.status(500).json({ error: "Google Gemini API key not configured" });
      }

      let interviewData: any = null;
      let questionHistory: any[] = [];

      if (db) {
        const interviewDoc = await db.collection('interviews').doc(id).get();
        if (interviewDoc.exists) {
          interviewData = interviewDoc.data();
        }

        const historySnapshot = await db.collection('interviews').doc(id).collection('history').orderBy('timestamp', 'desc').get();
        questionHistory = historySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      if (!interviewData) {
        return res.status(404).json({ error: "Interview not found" });
      }

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const suggestionPrompt = `Based on this candidate's interview performance, suggest 3-5 specific topics or question types for the next interview round.

Candidate: ${interviewData.candidateName}
Position: ${interviewData.jobContext?.jobTitle || 'Software Engineer'}
Current Round: ${interviewData.roundNumber || 1}

Performance Analysis:
${questionHistory.map((q, i) => `
Question ${i + 1}: ${q.questionType} (${q.difficulty})
${q.aiFeedback ? `Score: ${q.aiFeedback.scores?.overall || 'N/A'}/10` : 'No feedback available'}
${q.aiFeedback?.summary || ''}
`).join('\n')}

Provide suggestions in this format:
1. [Focus Area] - [Specific reasoning based on performance]
2. [Focus Area] - [Specific reasoning based on performance]

Focus on areas that need improvement or deeper exploration based on the scores and feedback.`;

      const result = await model.generateContent(suggestionPrompt);
      const suggestions = result.response.text();

      res.json({ suggestions });
    } catch (error) {
      console.error("Error generating suggestions:", error);
      res.status(500).json({ error: "Failed to generate suggestions" });
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
  latestCode?: string | null;
  latestCodeAnalysis?: any;
}) {
  const { candidateName, companyName, jobContext, questionHistory, overallSummary, interviewDate, latestCode, latestCodeAnalysis } = data;
  
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
            .header { break-inside: avoid; }
            .candidate-info { break-inside: avoid; }
            .summary-section { break-inside: avoid; }
        }
        
        /* Ensure content visibility */
        * {
            box-sizing: border-box;
        }
        
        .question-section {
            page-break-inside: avoid;
            break-inside: avoid;
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

    ${latestCode && latestCode.trim() && latestCode !== 'No code submitted' ? `
    <div class="latest-code-section" style="background: #fefce8; border: 2px solid #eab308; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
        <h3 style="color: #92400e; margin-top: 0; margin-bottom: 15px;">Latest Code Solution</h3>
        <div class="code-section">
            <div class="code-title">Final Submitted Code:</div>
            <div class="code-block">${latestCode}</div>
        </div>
        
        ${latestCodeAnalysis ? `
        <div class="feedback-section" style="margin-top: 20px;">
            <h4 style="margin-top: 0; color: #92400e;">AI Performance Analysis</h4>
            
            <div class="scores-grid">
                <div class="score-item">
                    <div class="score-label">Correctness (30%)</div>
                    <div class="score-value">${latestCodeAnalysis.scores.correctness}/10</div>
                </div>
                <div class="score-item">
                    <div class="score-label">Relevance (30%)</div>
                    <div class="score-value">${latestCodeAnalysis.scores.relevance}/10</div>
                </div>
                <div class="score-item">
                    <div class="score-label">Efficiency (15%)</div>
                    <div class="score-value">${latestCodeAnalysis.scores.efficiency}/10</div>
                </div>
                <div class="score-item">
                    <div class="score-label">Readability (15%)</div>
                    <div class="score-value">${latestCodeAnalysis.scores.readability}/10</div>
                </div>
                <div class="score-item">
                    <div class="score-label">Quality (10%)</div>
                    <div class="score-value">${latestCodeAnalysis.scores.quality}/10</div>
                </div>
                <div class="score-item" style="background: #f0f9ff; border-color: #0ea5e9;">
                    <div class="score-label">Weighted Overall</div>
                    <div class="score-value" style="color: #0ea5e9;">${latestCodeAnalysis.scores.overall}/10</div>
                </div>
            </div>
            
            ${latestCodeAnalysis.scoreNote ? `
            <div style="margin-top: 15px; padding: 10px; background: ${
              latestCodeAnalysis.scores.overall < 3 ? '#fef2f2; border-left: 4px solid #ef4444; color: #dc2626;' 
              : latestCodeAnalysis.scores.overall < 5 ? '#fffbeb; border-left: 4px solid #f59e0b; color: #d97706;'
              : latestCodeAnalysis.scores.overall < 7 ? '#eff6ff; border-left: 4px solid #3b82f6; color: #2563eb;'
              : '#f0fdf4; border-left: 4px solid #10b981; color: #059669;'
            } border-radius: 4px; font-weight: 600; text-align: center;">
                ${latestCodeAnalysis.scoreNote}
            </div>
            ` : ''}
            
            <div class="feedback-text" style="margin-top: 15px;">
                <strong>Summary:</strong> ${latestCodeAnalysis.summary}
            </div>
            
            ${latestCodeAnalysis.fullExplanation ? `
            <div class="feedback-text" style="margin-top: 15px;">
                <strong>Detailed Analysis:</strong> ${latestCodeAnalysis.fullExplanation}
            </div>
            ` : ''}
            
            ${latestCodeAnalysis.suggestion ? `
            <div class="feedback-text" style="margin-top: 15px;">
                <strong>Improvement Suggestions:</strong> ${latestCodeAnalysis.suggestion}
            </div>
            ` : ''}
        </div>
        ` : ''}
    </div>
    ` : `
    <div class="no-code-section" style="background: #f3f4f6; border: 2px dashed #9ca3af; border-radius: 8px; padding: 20px; margin-bottom: 30px; text-align: center;">
        <h3 style="color: #6b7280; margin-top: 0;">No Code Submitted</h3>
        <p style="color: #6b7280; margin-bottom: 0;">The candidate did not submit any code solution for analysis.</p>
    </div>
    `}

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
                        <div class="score-label">Correctness (30%)</div>
                        <div class="score-value">${question.aiFeedback.scores.correctness}/10</div>
                    </div>
                    <div class="score-item">
                        <div class="score-label">Relevance (30%)</div>
                        <div class="score-value">${question.aiFeedback.scores.relevance || question.aiFeedback.scores.correctness}/10</div>
                    </div>
                    <div class="score-item">
                        <div class="score-label">Efficiency (15%)</div>
                        <div class="score-value">${question.aiFeedback.scores.efficiency}/10</div>
                    </div>
                    <div class="score-item">
                        <div class="score-label">Readability (15%)</div>
                        <div class="score-value">${question.aiFeedback.scores.readability}/10</div>
                    </div>
                    <div class="score-item">
                        <div class="score-label">Quality (10%)</div>
                        <div class="score-value">${question.aiFeedback.scores.quality}/10</div>
                    </div>
                    <div class="score-item" style="background: #f0f9ff; border-color: #0ea5e9;">
                        <div class="score-label">Weighted Overall</div>
                        <div class="score-value" style="color: #0ea5e9;">${question.aiFeedback.scores.overall}/10</div>
                    </div>
                </div>
                ${question.aiFeedback.scoreNote ? `
                <div style="margin-top: 15px; padding: 10px; background: ${
                  question.aiFeedback.scores.overall < 3 ? '#fef2f2; border-left: 4px solid #ef4444; color: #dc2626;' 
                  : question.aiFeedback.scores.overall < 5 ? '#fffbeb; border-left: 4px solid #f59e0b; color: #d97706;'
                  : question.aiFeedback.scores.overall < 7 ? '#eff6ff; border-left: 4px solid #3b82f6; color: #2563eb;'
                  : '#f0fdf4; border-left: 4px solid #10b981; color: #059669;'
                } border-radius: 4px; font-weight: 600; text-align: center;">
                    ${question.aiFeedback.scoreNote}
                </div>
                ` : ''}
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
