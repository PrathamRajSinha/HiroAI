import { useState, useEffect } from "react";
import { MonacoEditor } from "@/components/monaco-editor";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams } from "wouter";

type TabType = "resume" | "github" | "linkedin";

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
  
  const isInterviewer = role === "interviewer";
  const isCandidate = role === "candidate";
  
  console.log("isInterviewer:", isInterviewer);
  console.log("isCandidate:", isCandidate);
  console.log("Should show button:", role !== "candidate");

  const generateQuestionMutation = useMutation({
    mutationFn: async (topic: string) => {
      return apiRequest("/api/generate-question", "POST", { topic, roomId });
    },
    onSuccess: (data: { question: string }) => {
      // For interviewers, don't automatically put question in editor
      // Store it for the candidate to receive via polling
      if (!isInterviewer) {
        const questionContent = `/*
${data.question}
*/

// Write your solution below:

`;
        setGeneratedQuestion(questionContent);
      }
      
      toast({
        title: "Question Generated!",
        description: "A new coding question has been generated and shared with the candidate.",
      });
    },
    onError: (error) => {
      console.error("Error generating question:", error);
      toast({
        title: "Error",
        description: "Failed to generate coding question. Please try again.",
        variant: "destructive",
      });
    },
  });

  const generateSummaryMutation = useMutation({
    mutationFn: async (code: string) => {
      return apiRequest("/api/generate-summary", "POST", { code });
    },
    onSuccess: (data: { summary: string }) => {
      setGeneratedSummary(data.summary);
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

  // Query to fetch room question for candidates
  const roomQuestionQuery = useQuery({
    queryKey: ["/api/room", roomId, "question"],
    queryFn: () => apiRequest(`/api/room/${roomId}/question`, "GET"),
    enabled: !!roomId,
    refetchInterval: 3000, // Poll every 3 seconds for real-time updates
  });

  // Update the editor with room question for candidates
  useEffect(() => {
    if (isCandidate && roomQuestionQuery.data?.question) {
      const questionContent = `/*
${roomQuestionQuery.data.question}
*/

// Write your solution below:

`;
      if (questionContent !== generatedQuestion) {
        setGeneratedQuestion(questionContent);
      }
    }
  }, [roomQuestionQuery.data, isCandidate]);

  const handleTabSwitch = (tab: TabType) => {
    setActiveTab(tab);
  };

  const generateCodingQuestion = () => {
    console.log("Generating question for roomId:", roomId);
    generateQuestionMutation.mutate("React");
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
          <div className="bg-white rounded-lg shadow-sm h-96 p-4 overflow-y-auto">
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
          <div className="bg-white rounded-lg shadow-sm h-96 p-4 overflow-y-auto">
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
          <div className="bg-white rounded-lg shadow-sm h-96 p-4 overflow-y-auto">
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
              {linkedinUrl && (
                <button
                  onClick={() => window.open(linkedinUrl, '_blank')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <span>👤</span>
                  View Profile
                </button>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="h-screen w-screen flex gap-4 p-4 bg-gray-50">
      {/* Left Panel - Video Call (25% width) */}
      <div className="w-1/4 bg-gray-100 rounded-xl p-2 min-h-full relative">
        {roomId ? (
          <>
            <iframe
              src={`https://aiinterview.daily.co/test-room`}
              className="w-full h-full rounded-xl shadow-md"
              allow="camera; microphone; fullscreen; speaker; display-capture"
              title="Daily Video Chat"
            />
            {/* Role indicator overlay */}
            {role && (
              <div className="absolute top-4 left-4 z-10">
                <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium shadow-md backdrop-blur-sm bg-opacity-90">
                  {role.charAt(0).toUpperCase() + role.slice(1)} View
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <div className="text-4xl mb-2">🎥</div>
              <div className="text-gray-600 text-sm">Loading video room...</div>
            </div>
          </div>
        )}
      </div>

      {/* Center Panel - Monaco Editor (50% width) */}
      <div className="w-1/2 bg-white rounded-xl shadow-md p-2 border border-gray-200 relative">
        {/* Floating Action Buttons - Show for interviewers and default users, hide for candidates */}
        {role !== "candidate" && (
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <button
              onClick={generateCodingQuestion}
              disabled={generateQuestionMutation.isPending}
              className="bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-sm font-medium flex items-center gap-2 hover:scale-105 disabled:hover:scale-100"
            >
              <span>{generateQuestionMutation.isPending ? "⏳" : "🎯"}</span>
              {generateQuestionMutation.isPending ? "Generating..." : "Generate Coding Question"}
            </button>
            <button
              onClick={generateSummary}
              disabled={generateSummaryMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-sm font-medium flex items-center gap-2 hover:scale-105 disabled:hover:scale-100"
            >
              <span>{generateSummaryMutation.isPending ? "⏳" : "🧠"}</span>
              {generateSummaryMutation.isPending ? "Generating..." : "Generate Summary"}
            </button>
          </div>
        )}
        
        <div className="h-full rounded-lg overflow-hidden">
          <MonacoEditor
            value={generatedQuestion}
            language="javascript"
            theme="vs"
            onChange={setEditorValue}
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
      <div className="w-1/4 bg-violet-50 rounded-xl p-4">
        {isInterviewer ? (
          <>
            {/* Interviewer View - Candidate Info Tabs */}
            <div className="flex space-x-1 mb-4">
              <button
                onClick={() => handleTabSwitch("resume")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === "resume"
                    ? "bg-violet-600 text-white"
                    : "bg-white text-gray-600 hover:bg-violet-100 hover:text-violet-700"
                }`}
              >
                Resume
              </button>
              <button
                onClick={() => handleTabSwitch("github")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === "github"
                    ? "bg-violet-600 text-white"
                    : "bg-white text-gray-600 hover:bg-violet-100 hover:text-violet-700"
                }`}
              >
                GitHub
              </button>
              <button
                onClick={() => handleTabSwitch("linkedin")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === "linkedin"
                    ? "bg-violet-600 text-white"
                    : "bg-white text-gray-600 hover:bg-violet-100 hover:text-violet-700"
                }`}
              >
                LinkedIn
              </button>
            </div>
            <div className="tab-content h-full">
              {renderTabContent()}
            </div>
          </>
        ) : isCandidate ? (
          /* Candidate View - Show current question or waiting state */
          <div className="p-4 bg-white rounded-lg shadow-sm h-full overflow-y-auto">
            {(() => {
              console.log("Candidate query data:", roomQuestionQuery.data);
              console.log("Query loading:", roomQuestionQuery.isLoading);
              console.log("Query error:", roomQuestionQuery.error);
              return null;
            })()}
            {roomQuestionQuery.data?.question ? (
              <div>
                <div className="text-lg font-medium text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-xl">📝</span>
                  Current Question
                </div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg border">
                  {roomQuestionQuery.data.question}
                </div>
                <div className="mt-4 text-xs text-gray-500">
                  Use the code editor to write your solution
                </div>
              </div>
            ) : roomQuestionQuery.isLoading ? (
              <div className="text-center p-6">
                <div className="text-4xl mb-4">⏳</div>
                <div className="text-gray-600 font-medium text-lg mb-2">Loading...</div>
                <div className="text-gray-400 text-sm">
                  Checking for interview questions
                </div>
              </div>
            ) : (
              <div className="text-center p-6">
                <div className="text-4xl mb-4">💻</div>
                <div className="text-gray-600 font-medium text-lg mb-2">Waiting for Question</div>
                <div className="text-gray-400 text-sm">
                  The interviewer will generate a coding question shortly
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
