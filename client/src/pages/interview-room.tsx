import { useState, useEffect } from "react";
import { MonacoEditor } from "@/components/monaco-editor";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams } from "wouter";
import { useInterviewRoom } from "@/hooks/useFirestore";
import { useCodeSync } from "@/hooks/useCodeSync";
import * as pdfjsLib from 'pdfjs-dist';

type TabType = "resume" | "github" | "linkedin" | "question" | "generate";

export default function InterviewRoom() {
  const params = useParams();
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const role = searchParams.get("role");
  const roomId = params.roomId;
  
  console.log("Current role:", role);
  console.log("Room ID:", roomId);
  console.log("Full location:", location);
  console.log("Role type:", typeof role);
  console.log("Role === 'candidate':", role === "candidate");
  
  const [activeTab, setActiveTab] = useState<TabType>("resume");
  const [editorValue, setEditorValue] = useState("");
  const [generatedSummary, setGeneratedSummary] = useState<string>("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeUrl, setResumeUrl] = useState<string>("");
  const [githubUrl, setGithubUrl] = useState<string>("");
  const [linkedinUrl, setLinkedinUrl] = useState<string>("");
  const [questionType, setQuestionType] = useState<string>("Coding");
  const [difficulty, setDifficulty] = useState<string>("Medium");
  const [linkedinSummary, setLinkedinSummary] = useState<string>("");
  const [isGeneratingFromProfile, setIsGeneratingFromProfile] = useState<boolean>(false);
  
  // Role detection
  const isInterviewer = role === "interviewer";
  const isCandidate = role === "candidate";
  
  // Firebase Firestore integration
  const { data: interviewData, loading: firestoreLoading, error: firestoreError, updateQuestion, updateSummary } = useInterviewRoom(roomId || "");
  
  // Real-time code synchronization
  const { code: syncedCode, isUpdating: isCodeSyncing, handleCodeChange } = useCodeSync({
    roomId: roomId || "",
    userRole: isInterviewer ? 'interviewer' : 'candidate',
    initialCode: "// Welcome to the coding interview!\n// Write your solution here...\n\nfunction solution() {\n  // Your code here\n}\n"
  });
  
  const [generatedQuestion, setGeneratedQuestion] = useState<string>(`// Welcome to the Interview Code Editor
// Click "Generate Coding Question" to get started with an AI-generated question
// This is where you can write and test code during the interview

function fibonacci(n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10));

// Feel free to modify this code or write your own!`);
  const { toast } = useToast();

  const generateQuestionMutation = useMutation({
    mutationFn: async ({ type, difficulty }: { type: string; difficulty: string }) => {
      return apiRequest("/api/generate-question", "POST", { type, difficulty, roomId });
    },
    onSuccess: async (data: { question: string }) => {
      // Save to Firebase Firestore for real-time sync
      await updateQuestion(data.question, questionType, difficulty);
      
      toast({
        title: "Question Generated!",
        description: "A new question has been generated and shared with the candidate.",
      });
    },
    onError: (error) => {
      console.error("Error generating question:", error);
      toast({
        title: "Error",
        description: "Failed to generate question. Please try again.",
        variant: "destructive",
      });
    },
  });

  const generateSummaryMutation = useMutation({
    mutationFn: async (code: string) => {
      return apiRequest("/api/generate-summary", "POST", { code });
    },
    onSuccess: async (data: { summary: string }) => {
      setGeneratedSummary(data.summary);
      // Save to Firebase Firestore for real-time sync
      await updateSummary(data.summary);
      
      toast({
        title: "Summary Generated!",
        description: "Code feedback summary has been generated successfully.",
      });
    },
    onError: (error) => {
      console.error("Error generating summary:", error);
      toast({
        title: "Error",
        description: "Failed to generate summary. Please try again.",
        variant: "destructive",
      });
    },
  });

  const generateFromProfileMutation = useMutation({
    mutationFn: async ({ type, content }: { type: "resume" | "github" | "linkedin"; content: string }) => {
      return apiRequest("/api/gen-from-source", "POST", { type, content, roomId });
    },
    onSuccess: async (data: { questions: string[] }) => {
      // Save the first question to Firebase Firestore for real-time sync
      if (data.questions && data.questions.length > 0) {
        await updateQuestion(data.questions.join('\n\n'), "Profile-based", "Medium");
      }
      
      toast({
        title: "Questions Generated!",
        description: `Generated ${data.questions.length} contextual questions from profile.`,
      });
      setIsGeneratingFromProfile(false);
    },
    onError: (error) => {
      console.error("Error generating questions from profile:", error);
      toast({
        title: "Error",
        description: "Failed to generate questions from profile. Please try again.",
        variant: "destructive",
      });
      setIsGeneratingFromProfile(false);
    },
  });

  const generateFromLinkedInMutation = useMutation({
    mutationFn: async (url: string) => {
      return apiRequest("/api/gen-from-linkedin", "POST", { url, roomId });
    },
    onSuccess: async (data: { questions: string[] }) => {
      // Save questions to Firebase Firestore for real-time sync
      if (data.questions && data.questions.length > 0) {
        await updateQuestion(data.questions.join('\n\n'), "LinkedIn Profile", "Medium");
      }
      
      toast({
        title: "LinkedIn Questions Generated!",
        description: `Generated ${data.questions.length} questions from LinkedIn profile.`,
      });
      setIsGeneratingFromProfile(false);
    },
    onError: (error) => {
      console.error("Error generating questions from LinkedIn:", error);
      toast({
        title: "Error",
        description: "Failed to generate questions from LinkedIn profile. Please try again.",
        variant: "destructive",
      });
      setIsGeneratingFromProfile(false);
    },
  });

  // Helper functions for extracting content from different sources
  const extractTextFromPDF = async (file: File): Promise<string> => {
    // Use the backend PDF extraction endpoint to handle PDF processing
    try {
      const formData = new FormData();
      formData.append('pdf', file);
      
      const response = await fetch('/api/extract-pdf-text', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Backend PDF processing failed');
      }
      
      const data = await response.json();
      
      if (data.fallback) {
        throw new Error(data.text);
      }
      
      return data.text;
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error('Unable to extract text from PDF. Please copy your resume content into the LinkedIn summary field and use "Ask from LinkedIn" instead.');
    }
  };

  const fetchGitHubReadme = async (repoUrl: string): Promise<string> => {
    try {
      // Extract owner and repo from GitHub URL
      const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!match) {
        throw new Error('Invalid GitHub URL format');
      }
      
      const [, owner, repo] = match;
      const cleanRepo = repo.replace(/\.git$/, '');
      
      // Try to fetch README.md
      const apiUrl = `https://api.github.com/repos/${owner}/${cleanRepo}/readme`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error('Failed to fetch README from GitHub');
      }
      
      const data = await response.json();
      const content = atob(data.content.replace(/\s/g, ''));
      
      return content;
    } catch (error) {
      console.error('Error fetching GitHub README:', error);
      throw new Error('Failed to fetch GitHub README');
    }
  };

  const generateFromProfile = async (sourceType: "resume" | "github" | "linkedin") => {
    setIsGeneratingFromProfile(true);
    
    try {
      let content = '';
      
      switch (sourceType) {
        case 'resume':
          if (!resumeFile) {
            throw new Error('No resume file uploaded');
          }
          try {
            content = await extractTextFromPDF(resumeFile);
          } catch (pdfError) {
            // Fallback: ask user to manually provide resume content
            throw new Error('PDF extraction failed. Please copy and paste your resume content into the LinkedIn summary field and use "Ask from LinkedIn" instead.');
          }
          break;
          
        case 'github':
          if (!githubUrl) {
            throw new Error('No GitHub URL provided');
          }
          content = await fetchGitHubReadme(githubUrl);
          break;
          
        case 'linkedin':
          if (!linkedinSummary.trim()) {
            throw new Error('No LinkedIn summary provided');
          }
          content = linkedinSummary;
          break;
          
        default:
          throw new Error('Invalid source type');
      }
      
      generateFromProfileMutation.mutate({ type: sourceType, content });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to extract content",
        variant: "destructive",
      });
      setIsGeneratingFromProfile(false);
    }
  };

  const generateFromLinkedInProfile = async () => {
    setIsGeneratingFromProfile(true);
    
    try {
      if (!linkedinUrl.trim()) {
        throw new Error('No LinkedIn URL provided');
      }
      
      generateFromLinkedInMutation.mutate(linkedinUrl);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process LinkedIn URL",
        variant: "destructive",
      });
      setIsGeneratingFromProfile(false);
    }
  };

  // Update state when Firebase data changes
  useEffect(() => {
    if (interviewData.summary) {
      setGeneratedSummary(interviewData.summary);
    }
  }, [interviewData.summary]);

  const handleTabSwitch = (tab: TabType) => {
    setActiveTab(tab);
  };

  const generateSmartQuestion = (type: string, difficulty: string) => {
    generateQuestionMutation.mutate({ type, difficulty });
  };

  const generateSummary = () => {
    const currentCode = editorValue || generatedQuestion;
    if (!currentCode.trim()) {
      toast({
        title: "No Code Found",
        description: "Please write some code before generating a summary.",
        variant: "destructive",
      });
      return;
    }
    generateSummaryMutation.mutate(currentCode);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setResumeFile(file);
      const url = URL.createObjectURL(file);
      setResumeUrl(url);
    } else {
      toast({
        title: "Invalid File",
        description: "Please upload a PDF file.",
        variant: "destructive",
      });
    }
  };

  const clearResume = () => {
    if (resumeUrl) {
      URL.revokeObjectURL(resumeUrl);
    }
    setResumeFile(null);
    setResumeUrl("");
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "resume":
        return (
          <div className="bg-white rounded-lg shadow-sm h-full p-4 overflow-y-auto">
            {!resumeFile ? (
              <div className="flex flex-col items-center justify-center h-full border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-4xl mb-4">📄</div>
                <div className="text-gray-600 font-medium mb-4">Upload Resume</div>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="resume-upload"
                />
                <label
                  htmlFor="resume-upload"
                  className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg cursor-pointer transition-colors text-sm font-medium"
                >
                  Choose PDF File
                </label>
                <div className="text-gray-400 text-xs mt-2">
                  PDF files only, max 10MB
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700 truncate">
                    {resumeFile.name}
                  </span>
                  <button
                    onClick={clearResume}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    Remove
                  </button>
                </div>
                <iframe
                  src={resumeUrl}
                  className="flex-1 w-full border border-gray-200 rounded"
                  title="Resume PDF"
                />
              </div>
            )}
          </div>
        );
      case "github":
        return (
          <div className="bg-white rounded-lg shadow-sm h-full p-4 overflow-y-auto">
            <div className="text-lg font-medium text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-xl">💻</span>
              GitHub Repository
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Repository URL
                </label>
                <input
                  type="url"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/username/repo"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
                />
              </div>
              {githubUrl && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-700">Repository Link:</div>
                  <a
                    href={githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-violet-600 hover:text-violet-800 text-sm underline break-all"
                  >
                    <span>🔗</span>
                    {githubUrl}
                  </a>
                </div>
              )}
            </div>
          </div>
        );
      case "linkedin":
        return (
          <div className="bg-white rounded-lg shadow-sm h-full p-4 overflow-y-auto">
            <div className="text-lg font-medium text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-xl">💼</span>
              LinkedIn Profile
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Profile URL
                </label>
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Professional Summary
                </label>
                <textarea
                  value={linkedinSummary}
                  onChange={(e) => setLinkedinSummary(e.target.value)}
                  placeholder="Paste the candidate's LinkedIn summary/about section here..."
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm resize-none"
                />
              </div>
              {linkedinUrl && (
                <div className="space-y-3">
                  <button
                    onClick={() => window.open(linkedinUrl, '_blank')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <span>👤</span>
                    View Profile
                  </button>
                  
                  <button
                    onClick={() => generateFromLinkedInProfile()}
                    disabled={isGeneratingFromProfile || !linkedinUrl.trim()}
                    className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <span className="text-base">🎯</span>
                    <span>
                      {isGeneratingFromProfile && generateFromLinkedInMutation.isPending
                        ? "Fetching Profile & Generating..." 
                        : "Ask From LinkedIn"}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      case "question":
        return (
          <div className="bg-white rounded-lg shadow-sm h-full p-4 overflow-y-auto">
            <div className="text-lg font-medium text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-xl">📝</span>
              Current Question
            </div>
            {firestoreLoading ? (
              <div className="text-center p-4 text-gray-500">
                <div className="text-2xl mb-2">⏳</div>
                <div className="text-sm">Loading...</div>
              </div>
            ) : interviewData.question ? (
              <div className="space-y-3">
                {interviewData.questionType && interviewData.difficulty && (
                  <div className="flex gap-2">
                    <span className="px-2 py-1 bg-violet-100 text-violet-700 rounded text-xs font-medium">
                      {interviewData.questionType}
                    </span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                      {interviewData.difficulty}
                    </span>
                  </div>
                )}
                <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg border">
                  {interviewData.question}
                </div>
              </div>
            ) : (
              <div className="text-center p-4 text-gray-500">
                <div className="text-2xl mb-2">📋</div>
                <div className="text-sm">No question generated yet</div>
                <div className="text-xs mt-1">Generate a question to get started</div>
              </div>
            )}
          </div>
        );
      case "generate":
        return (
          <div className="bg-white rounded-lg shadow-sm h-full p-4 overflow-y-auto">
            <div className="text-lg font-medium text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-xl">🎯</span>
              Generate Questions from Profile
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-violet-50 rounded-lg border border-violet-200">
                <p className="text-sm text-violet-700 mb-2 font-medium">
                  Generate contextual interview questions based on candidate's profile
                </p>
                <p className="text-xs text-violet-600">
                  Each button will extract relevant information and generate 2 tailored questions
                </p>
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={() => generateFromProfile('resume')}
                  disabled={isGeneratingFromProfile || !resumeFile}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-sm font-medium flex items-center justify-center gap-2"
                >
                  <span className="text-base">📄</span>
                  <span>
                    {isGeneratingFromProfile && generateFromProfileMutation.variables?.type === 'resume' 
                      ? "Processing..." 
                      : "Guide me to LinkedIn"}
                  </span>
                  {!resumeFile && <span className="text-xs opacity-75">(Upload required)</span>}
                </button>
                
                <button
                  onClick={() => generateFromProfile('github')}
                  disabled={isGeneratingFromProfile || !githubUrl.trim()}
                  className="w-full bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-sm font-medium flex items-center justify-center gap-2"
                >
                  <span className="text-base">💻</span>
                  <span>{isGeneratingFromProfile ? "Generating..." : "Ask from GitHub"}</span>
                  {!githubUrl.trim() && <span className="text-xs opacity-75">(URL required)</span>}
                </button>
                
                <button
                  onClick={() => generateFromProfile('linkedin')}
                  disabled={isGeneratingFromProfile || !linkedinSummary.trim()}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-sm font-medium flex items-center justify-center gap-2"
                >
                  <span className="text-base">💼</span>
                  <span>{isGeneratingFromProfile ? "Generating..." : "Ask from LinkedIn"}</span>
                  {!linkedinSummary.trim() && <span className="text-xs opacity-75">(Summary required)</span>}
                </button>
              </div>
              
              {generateFromProfileMutation.isPending && (
                <div className="text-center p-4 text-gray-500">
                  <div className="text-2xl mb-2">⏳</div>
                  <div className="text-sm">Analyzing profile and generating questions...</div>
                  <div className="text-xs mt-1">This may take a few moments</div>
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="h-screen w-screen flex gap-4 p-4 bg-gray-50">
      {/* Left Panel - Video Call (15% width) */}
      <div className="w-[15%] h-[60%] bg-gradient-to-br from-gray-50 to-slate-100 rounded-xl p-3 relative border border-gray-200 shadow-sm">
        {roomId ? (
          <>
            <iframe
              src={`https://aiinterview.daily.co/test-room`}
              className="w-full h-full rounded-xl shadow-lg border border-gray-300"
              allow="camera; microphone; fullscreen; speaker; display-capture"
              title="Daily Video Chat"
            />
            {/* Role indicator overlay */}
            {role && (
              <div className="absolute top-6 left-6 z-10">
                <div className="px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg text-xs font-semibold shadow-lg backdrop-blur-sm border border-blue-400">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    <span>{role.charAt(0).toUpperCase() + role.slice(1)} View</span>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-center">
            <div className="p-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full flex items-center justify-center">
                <span className="text-white text-2xl">🎥</span>
              </div>
              <div className="text-gray-700 font-semibold text-base mb-2">Loading Video Room</div>
              <div className="text-gray-500 text-sm">Connecting to Daily.co...</div>
            </div>
          </div>
        )}
      </div>

      {/* Center Panel - Monaco Editor (60% width) */}
      <div className="w-[60%] bg-white rounded-xl shadow-lg p-4 border border-gray-200 relative">
        {/* Question Generation Section - Show for interviewers and default users, hide for candidates */}
        {role !== "candidate" && (
          <div className="bg-violet-50 p-4 rounded-xl space-y-3 mb-4">
            <h3 className="text-lg font-semibold text-violet-800">Generate a Question</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-violet-700 mb-1">Question Type</label>
                <select
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value)}
                  className="w-full px-3 py-2 border border-violet-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm bg-white"
                >
                  <option value="Coding">Coding</option>
                  <option value="Behavioral">Behavioral</option>
                  <option value="Situational">Situational</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-violet-700 mb-1">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full px-3 py-2 border border-violet-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm bg-white"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => generateSmartQuestion(questionType, difficulty)}
                disabled={generateQuestionMutation.isPending}
                className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:from-purple-400 disabled:to-purple-500 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-sm font-medium flex items-center gap-2 hover:scale-[1.02] disabled:hover:scale-100"
              >
                <span className="text-base">{generateQuestionMutation.isPending ? "⏳" : "✨"}</span>
                <span>{generateQuestionMutation.isPending ? "Generating..." : "Generate"}</span>
              </button>
              
              <button
                onClick={generateSummary}
                disabled={generateSummaryMutation.isPending}
                className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:from-indigo-400 disabled:to-indigo-500 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-sm font-medium flex items-center gap-2 hover:scale-[1.02] disabled:hover:scale-100"
              >
                <span className="text-base">{generateSummaryMutation.isPending ? "⏳" : "🧠"}</span>
                <span>{generateSummaryMutation.isPending ? "Generating..." : "Summary"}</span>
              </button>
            </div>
          </div>
        )}
        
        <div className="rounded-lg overflow-hidden h-full relative">
          {/* Sync Status Indicator */}
          {isCodeSyncing && (
            <div className="absolute top-2 right-2 z-10 bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              Syncing...
            </div>
          )}
          
          <MonacoEditor
            value={syncedCode}
            language="javascript"
            theme="vs"
            onChange={handleCodeChange}
          />
        </div>
        
        {/* Summary Card - Show below editor when summary is generated */}
        {generatedSummary && (
          <div className="absolute bottom-4 left-4 right-4 z-10 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-h-48 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-800">Code Feedback Summary</h3>
              <button
                onClick={() => setGeneratedSummary("")}
                className="text-gray-400 hover:text-gray-600 text-xs"
              >
                ✕
              </button>
            </div>
            <div className="text-xs text-gray-600 whitespace-pre-wrap">
              {generatedSummary}
            </div>
          </div>
        )}
      </div>

      {/* Right Panel - Role-based content (25% width) */}
      <div className="w-[25%] bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl p-4 border border-violet-100 shadow-sm">
        {/* Role and Sync Status Header */}
        <div className="mb-4 p-3 bg-white rounded-lg border border-violet-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{isInterviewer ? "👨‍💼" : "👨‍💻"}</span>
              <span className="text-sm font-medium text-violet-700">
                {isInterviewer ? "Interviewer" : "Candidate"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${isCodeSyncing ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
              <span className="text-xs text-gray-600">
                {isCodeSyncing ? "Syncing" : "Live"}
              </span>
            </div>
          </div>
        </div>
        
        {isInterviewer ? (
          <>
            {/* Interviewer View - Candidate Info Tabs */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <button
                onClick={() => handleTabSwitch("resume")}
                className={`px-3 py-2.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                  activeTab === "resume"
                    ? "bg-gradient-to-r from-violet-600 to-violet-700 text-white shadow-md"
                    : "bg-white text-gray-600 hover:bg-violet-100 hover:text-violet-700 border border-violet-200"
                }`}
              >
                📄 Resume
              </button>
              <button
                onClick={() => handleTabSwitch("github")}
                className={`px-3 py-2.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                  activeTab === "github"
                    ? "bg-gradient-to-r from-violet-600 to-violet-700 text-white shadow-md"
                    : "bg-white text-gray-600 hover:bg-violet-100 hover:text-violet-700 border border-violet-200"
                }`}
              >
                💻 GitHub
              </button>
              <button
                onClick={() => handleTabSwitch("linkedin")}
                className={`px-3 py-2.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                  activeTab === "linkedin"
                    ? "bg-gradient-to-r from-violet-600 to-violet-700 text-white shadow-md"
                    : "bg-white text-gray-600 hover:bg-violet-100 hover:text-violet-700 border border-violet-200"
                }`}
              >
                💼 LinkedIn
              </button>
              <button
                onClick={() => handleTabSwitch("question")}
                className={`px-3 py-2.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                  activeTab === "question"
                    ? "bg-gradient-to-r from-violet-600 to-violet-700 text-white shadow-md"
                    : "bg-white text-gray-600 hover:bg-violet-100 hover:text-violet-700 border border-violet-200"
                }`}
              >
                📝 Question
              </button>
              <button
                onClick={() => handleTabSwitch("generate")}
                className={`px-3 py-2.5 text-xs font-medium rounded-lg transition-all duration-200 col-span-2 ${
                  activeTab === "generate"
                    ? "bg-gradient-to-r from-violet-600 to-violet-700 text-white shadow-md"
                    : "bg-white text-gray-600 hover:bg-violet-100 hover:text-violet-700 border border-violet-200"
                }`}
              >
                🎯 Generate Questions
              </button>
            </div>
            <div className="tab-content h-[calc(100%-4rem)]">
              {renderTabContent()}
            </div>
          </>
        ) : isCandidate ? (
          /* Candidate View - Show current question or waiting state */
          <div className="p-6 bg-white rounded-lg shadow-sm h-full overflow-y-auto border border-violet-100">
            {firestoreLoading ? (
              <div className="text-center p-8">
                <div className="w-12 h-12 mx-auto mb-4 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xl">⏳</span>
                </div>
                <div className="text-gray-700 font-semibold text-lg mb-2">Loading...</div>
                <div className="text-gray-500 text-sm">
                  Connecting to interview room...
                </div>
              </div>
            ) : interviewData.question ? (
              <div>
                <div className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">📝</span>
                  </div>
                  <span>Current Question</span>
                </div>
                
                {interviewData.questionType && interviewData.difficulty && (
                  <div className="flex gap-2 mb-4">
                    <span className="px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-medium">
                      {interviewData.questionType}
                    </span>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                      {interviewData.difficulty}
                    </span>
                  </div>
                )}
                
                <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gradient-to-r from-gray-50 to-violet-50 p-4 rounded-lg border border-violet-100">
                  {interviewData.question}
                </div>
                <div className="mt-4 p-3 bg-violet-50 rounded-lg border border-violet-200">
                  <p className="text-xs text-violet-700 font-medium">
                    💡 Use the code editor to implement your solution
                  </p>
                </div>
              </div>
            ) : firestoreError ? (
              <div className="text-center p-8">
                <div className="w-12 h-12 mx-auto mb-4 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-xl">⚠️</span>
                </div>
                <div className="text-red-700 font-semibold text-lg mb-2">Connection Error</div>
                <div className="text-red-600 text-sm">
                  {firestoreError}
                </div>
              </div>
            ) : (
              <div className="text-center p-8">
                <div className="w-12 h-12 mx-auto mb-4 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xl">💻</span>
                </div>
                <div className="text-gray-700 font-semibold text-lg mb-2">Waiting for Question</div>
                <div className="text-gray-500 text-sm">
                  The interviewer will generate a question shortly
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Default View - No role specified */
          <div className="text-center p-6 bg-white rounded-lg shadow-sm h-full">
            <div className="text-4xl mb-4">👋</div>
            <div className="text-gray-600 font-medium text-lg mb-2">Welcome</div>
            <div className="text-gray-400 text-sm mb-4">
              Add ?role=interviewer or ?role=candidate to the URL to access role-specific features
            </div>
            <div className="mt-4 space-y-2 text-left">
              <div className="text-sm">
                <strong>Interviewer:</strong> Access candidate info and question generation
              </div>
              <div className="text-sm">
                <strong>Candidate:</strong> Take notes and focus on coding
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
