import { useState } from "react";
import { MonacoEditor } from "@/components/monaco-editor";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams } from "wouter";

type TabType = "resume" | "github" | "linkedin";

export default function InterviewRoom() {
  const params = useParams();
  const [location] = useLocation();
  const role = new URLSearchParams(location.split('?')[1] || '').get("role");
  const roomId = params.roomId;
  
  console.log("Current role:", role);
  console.log("Room ID:", roomId);
  console.log("Full location:", location);
  
  const [activeTab, setActiveTab] = useState<TabType>("resume");
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [editorValue, setEditorValue] = useState("");
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
  console.log("Should show button (!isCandidate):", !isCandidate);

  const generateQuestionMutation = useMutation({
    mutationFn: async (topic: string) => {
      return apiRequest("/api/generate-question", "POST", { topic });
    },
    onSuccess: (data: { question: string }) => {
      const questionContent = `/*
${data.question}
*/

// Write your solution below:

`;
      setGeneratedQuestion(questionContent);
      toast({
        title: "Question Generated!",
        description: "A new coding question has been generated and displayed in the editor.",
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

  const handleTabSwitch = (tab: TabType) => {
    setActiveTab(tab);
  };

  const generateCodingQuestion = () => {
    generateQuestionMutation.mutate("React");
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleVideo = () => {
    setIsVideoOn(!isVideoOn);
  };

  const renderTabContent = () => {
    const baseContentClass = "text-center p-8 bg-white rounded-lg shadow-sm h-96";
    
    switch (activeTab) {
      case "resume":
        return (
          <div className={baseContentClass}>
            <div className="text-4xl mb-4">👤</div>
            <div className="text-gray-600 font-medium">Resume Content</div>
            <div className="text-gray-400 text-sm mt-2">
              Candidate's resume will be displayed here
            </div>
            <div className="mt-4 space-y-3 text-left">
              <div className="border-b border-gray-200 pb-2">
                <div className="font-semibold text-gray-800">John Doe</div>
                <div className="text-sm text-gray-500">Senior Software Engineer</div>
              </div>
              <div className="text-sm space-y-1">
                <div className="font-medium text-gray-700">Experience:</div>
                <div className="text-gray-600">5+ years in React, Node.js</div>
              </div>
            </div>
          </div>
        );
      case "github":
        return (
          <div className={baseContentClass}>
            <div className="text-4xl mb-4">⚡</div>
            <div className="text-gray-600 font-medium">GitHub Profile</div>
            <div className="text-gray-400 text-sm mt-2">
              GitHub repositories and contributions
            </div>
            <div className="mt-4 space-y-3 text-left">
              <div className="border-b border-gray-200 pb-2">
                <div className="font-semibold text-gray-800">@johndoe</div>
                <div className="text-sm text-gray-500">42 repositories</div>
              </div>
              <div className="text-sm space-y-1">
                <div className="font-medium text-gray-700">Recent Projects:</div>
                <div className="text-gray-600">react-dashboard, api-gateway</div>
              </div>
            </div>
          </div>
        );
      case "linkedin":
        return (
          <div className={baseContentClass}>
            <div className="text-4xl mb-4">💼</div>
            <div className="text-gray-600 font-medium">LinkedIn Profile</div>
            <div className="text-gray-400 text-sm mt-2">
              Professional background and network
            </div>
            <div className="mt-4 space-y-3 text-left">
              <div className="border-b border-gray-200 pb-2">
                <div className="font-semibold text-gray-800">John Doe</div>
                <div className="text-sm text-gray-500">500+ connections</div>
              </div>
              <div className="text-sm space-y-1">
                <div className="font-medium text-gray-700">Current Role:</div>
                <div className="text-gray-600">Senior Engineer at TechCorp</div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="h-screen w-screen flex gap-4 p-4 bg-gray-50">
      {/* Left Panel - Video Call (25% width) */}
      <div className="w-1/4 bg-gray-100 rounded-xl p-6 flex items-center justify-center min-h-full">
        <div className="text-center">
          <div className="text-6xl mb-4">🎥</div>
          <div className="text-gray-600 font-medium text-lg">Video Here</div>
          <div className="text-gray-400 text-sm mt-2">
            Camera feed will appear here
          </div>
          
          {/* Role and Room indicators */}
          <div className="mt-3 space-y-2">
            {role && (
              <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                {role.charAt(0).toUpperCase() + role.slice(1)} View
              </div>
            )}
            {roomId && (
              <div className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                Room: {roomId}
              </div>
            )}
          </div>
          
          <div className="mt-4 space-y-2">
            <div className="flex justify-center space-x-2">
              <button
                onClick={toggleMute}
                className={`w-10 h-10 ${
                  isMuted
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-green-500 hover:bg-green-600"
                } rounded-full flex items-center justify-center text-white transition-colors`}
              >
                <span className="text-sm">{isMuted ? "🔇" : "🔊"}</span>
              </button>
              <button
                onClick={toggleVideo}
                className={`w-10 h-10 ${
                  isVideoOn
                    ? "bg-gray-600 hover:bg-gray-700"
                    : "bg-red-500 hover:bg-red-600"
                } rounded-full flex items-center justify-center text-white transition-colors`}
              >
                <span className="text-sm">{isVideoOn ? "📹" : "📷"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Center Panel - Monaco Editor (50% width) */}
      <div className="w-1/2 bg-white rounded-xl shadow-md p-2 border border-gray-200 relative">
        {/* Floating Generate Question Button - Only for interviewers */}
        {isInterviewer && (
          <button
            onClick={generateCodingQuestion}
            disabled={generateQuestionMutation.isPending}
            className="absolute top-4 right-4 z-10 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-sm font-medium flex items-center gap-2 hover:scale-105 disabled:hover:scale-100"
          >
            <span>{generateQuestionMutation.isPending ? "⏳" : "🎯"}</span>
            {generateQuestionMutation.isPending ? "Generating..." : "Generate Coding Question"}
          </button>
        )}
        
        <div className="h-full rounded-lg overflow-hidden">
          <MonacoEditor
            value={generatedQuestion}
            language="javascript"
            theme="vs"
            onChange={setEditorValue}
          />
        </div>
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
          /* Candidate View - Instructions/Notes */
          <div className="text-center p-6 bg-white rounded-lg shadow-sm h-full">
            <div className="text-4xl mb-4">📝</div>
            <div className="text-gray-600 font-medium text-lg mb-2">Interview Notes</div>
            <div className="text-gray-400 text-sm mb-4">
              Take notes during the interview
            </div>
            <textarea
              className="w-full h-64 p-3 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              placeholder="Write your thoughts, approach, or any notes here..."
            />
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
