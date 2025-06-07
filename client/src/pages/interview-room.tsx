import { useState } from "react";
import { MonacoEditor } from "@/components/monaco-editor";

type TabType = "resume" | "github" | "linkedin";

export default function InterviewRoom() {
  const [activeTab, setActiveTab] = useState<TabType>("resume");
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [editorValue, setEditorValue] = useState("");

  const handleTabSwitch = (tab: TabType) => {
    setActiveTab(tab);
  };

  const generateCodingQuestion = () => {
    // Placeholder function for generating coding questions
    console.log("Generating coding question...");
    // Future implementation: AI-powered question generation
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
        {/* Floating Generate Question Button */}
        <button
          onClick={generateCodingQuestion}
          className="absolute top-4 right-4 z-10 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-sm font-medium flex items-center gap-2 hover:scale-105"
        >
          <span>🎯</span>
          Generate Coding Question
        </button>
        
        <div className="h-full rounded-lg overflow-hidden">
          <MonacoEditor
            language="javascript"
            theme="vs"
            onChange={setEditorValue}
          />
        </div>
      </div>

      {/* Right Panel - Candidate Info Tabs (25% width) */}
      <div className="w-1/4 bg-violet-50 rounded-xl p-4">
        {/* Tab Navigation */}
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

        {/* Tab Content */}
        <div className="tab-content h-full">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}
