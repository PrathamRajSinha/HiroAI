import { useState, useEffect } from "react";
import { MonacoEditor } from "@/components/monaco-editor";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams } from "wouter";
import { useInterviewRoom, QuestionHistory } from "@/hooks/useFirestore";
import { useCodeSync } from "@/hooks/useCodeSync";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileText, Github, Linkedin, MessageCircle, History, ChevronDown, ChevronRight, Code, Brain, Video } from "lucide-react";
import { VideoCall } from "@/components/video-call";
import * as pdfjsLib from 'pdfjs-dist';

type TabType = "question" | "history" | "resume" | "github" | "linkedin";

export default function InterviewRoom() {
  const params = useParams();
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const role = searchParams.get("role");
  const roomId = params.roomId;
  
  // Role detection
  const isInterviewer = role === "interviewer";
  const isCandidate = role === "candidate";
  
  // State management
  const [activeTab, setActiveTab] = useState<TabType>(isInterviewer ? "history" : "question");
  const [generatedSummary, setGeneratedSummary] = useState<string>("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeUrl, setResumeUrl] = useState<string>("");
  const [githubUrl, setGithubUrl] = useState<string>("");
  const [linkedinUrl, setLinkedinUrl] = useState<string>("");
  const [questionType, setQuestionType] = useState<string>("Coding");
  const [difficulty, setDifficulty] = useState<string>("Medium");
  const [isGeneratingFromProfile, setIsGeneratingFromProfile] = useState<boolean>(false);
  
  // Generated questions for each source
  const [generatedResumeQuestions, setGeneratedResumeQuestions] = useState<string[]>([]);
  const [generatedGitHubQuestions, setGeneratedGitHubQuestions] = useState<string[]>([]);
  const [generatedLinkedInQuestions, setGeneratedLinkedInQuestions] = useState<string[]>([]);
  
  // Firebase Firestore integration
  const { data: interviewData, loading: firestoreLoading, error: firestoreError, updateQuestion, updateSummary, getQuestionHistory, updateQuestionWithCode } = useInterviewRoom(roomId || "");
  
  // Previous questions state
  const [questionHistory, setQuestionHistory] = useState<QuestionHistory[]>([]);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [lastSubmittedQuestionId, setLastSubmittedQuestionId] = useState<string | null>(null);
  
  // Real-time code synchronization
  const { code: syncedCode, isUpdating: isCodeSyncing, handleCodeChange } = useCodeSync({
    roomId: roomId || "",
    userRole: isInterviewer ? 'interviewer' : 'candidate',
    initialCode: "// Welcome to the coding interview!\n// Write your solution here...\n\nfunction solution() {\n  // Your code here\n}\n"
  });
  
  const { toast } = useToast();

  // Load question history when component mounts or room changes
  useEffect(() => {
    const loadHistory = async () => {
      if (roomId) {
        const history = await getQuestionHistory();
        setQuestionHistory(history);
      }
    };
    loadHistory();
  }, [roomId, getQuestionHistory]);

  // Reload history when a new question is added
  useEffect(() => {
    if (interviewData.question && interviewData.timestamp) {
      const loadHistory = async () => {
        const history = await getQuestionHistory();
        setQuestionHistory(history);
      };
      loadHistory();
    }
  }, [interviewData.question, interviewData.timestamp, getQuestionHistory]);

  // Mutations
  const generateQuestionMutation = useMutation({
    mutationFn: async ({ type, difficulty }: { type: string; difficulty: string }) => {
      return apiRequest("/api/generate-question", "POST", { type, difficulty, roomId });
    },
    onSuccess: async (data: { question: string }) => {
      await updateQuestion(data.question, questionType, difficulty);
      toast({
        title: "Question Generated",
        description: "New coding question has been generated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to generate question. Please try again.",
        variant: "destructive",
      });
    },
  });

  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/generate-summary", "POST", { code: syncedCode });
    },
    onSuccess: (data: { summary: string }) => {
      setGeneratedSummary(data.summary);
      toast({
        title: "Summary Generated",
        description: "Code analysis summary has been generated.",
      });
    },
    onError: (error) => {
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
      if (data.questions && data.questions.length > 0) {
        setGeneratedLinkedInQuestions(data.questions);
      }
      
      toast({
        title: "LinkedIn Questions Generated!",
        description: `Generated ${data.questions.length} questions from LinkedIn profile.`,
      });
      setIsGeneratingFromProfile(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to generate questions from LinkedIn. Please try again.",
        variant: "destructive",
      });
      setIsGeneratingFromProfile(false);
    },
  });

  const generateFromGitHubMutation = useMutation({
    mutationFn: async (username: string) => {
      return apiRequest("/api/gen-from-github", "POST", { username, roomId });
    },
    onSuccess: async (data: { questions: string[] }) => {
      if (data.questions && data.questions.length > 0) {
        setGeneratedGitHubQuestions(data.questions);
      }
      
      toast({
        title: "GitHub Questions Generated!",
        description: `Generated ${data.questions.length} questions from GitHub profile.`,
      });
      setIsGeneratingFromProfile(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to generate questions from GitHub. Please try again.",
        variant: "destructive",
      });
      setIsGeneratingFromProfile(false);
    },
  });

  const generateFromResumeMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('resume', file);
      formData.append('roomId', roomId || '');
      
      const response = await fetch('/api/gen-from-resume', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to process resume');
      }
      
      return response.json();
    },
    onSuccess: async (data: { questions: string[] }) => {
      if (data.questions && data.questions.length > 0) {
        setGeneratedResumeQuestions(data.questions);
      }
      
      toast({
        title: "Resume Questions Generated!",
        description: `Generated ${data.questions.length} questions from resume analysis.`,
      });
      setIsGeneratingFromProfile(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to generate questions from resume. Please try again.",
        variant: "destructive",
      });
      setIsGeneratingFromProfile(false);
    },
  });

  const submitAnswerMutation = useMutation({
    mutationFn: async ({ code, question, questionId }: { code: string; question: string; questionId: string }) => {
      const response = await fetch('/api/analyze-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, question }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to analyze code');
      }

      const feedback = await response.json();
      return { feedback, questionId };
    },
    onSuccess: async ({ feedback, questionId }) => {
      await updateQuestionWithCode(questionId, syncedCode, feedback);
      setLastSubmittedQuestionId(questionId);
      
      // Only show feedback score to interviewers, simple confirmation for candidates
      if (isInterviewer) {
        toast({
          title: "Answer Submitted",
          description: `AI feedback generated with overall score: ${feedback.scores.overall}/10`,
        });
      } else {
        toast({
          title: "Answer Submitted",
          description: "Your code has been submitted for review",
        });
      }
      
      // Refresh question history
      const history = await getQuestionHistory();
      setQuestionHistory(history);
      
      setIsSubmittingAnswer(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setIsSubmittingAnswer(false);
    }
  });

  // Helper functions
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const truncateQuestion = (question: string, maxLength: number = 80) => {
    if (question.length <= maxLength) return question;
    return question.substring(0, maxLength) + "...";
  };

  const handleSubmitAnswer = async () => {
    if (!interviewData.question || !syncedCode.trim() || !roomId) {
      toast({
        title: "Error",
        description: "No question or code to submit",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingAnswer(true);

    try {
      // Get fresh history and find the current question
      const history = await getQuestionHistory();
      console.log("Current question:", interviewData.question);
      console.log("History:", history);
      
      let currentQuestionEntry = history.find(
        (item) => item.question === interviewData.question
      );

      // If not found in history, use the most recent entry or create a temporary ID
      if (!currentQuestionEntry && history.length > 0) {
        currentQuestionEntry = history[0]; // Most recent question
        console.log("Using most recent question from history");
      }

      if (!currentQuestionEntry) {
        // Create a fallback ID based on current data
        const tempId = `temp-${Date.now()}`;
        console.log("No question found in history, using temp ID:", tempId);
        
        submitAnswerMutation.mutate({
          code: syncedCode,
          question: interviewData.question,
          questionId: tempId,
        });
        return;
      }

      console.log("Submitting answer for question ID:", currentQuestionEntry.id);
      submitAnswerMutation.mutate({
        code: syncedCode,
        question: interviewData.question,
        questionId: currentQuestionEntry.id,
      });
    } catch (error) {
      console.error("Submit answer error:", error);
      toast({
        title: "Error", 
        description: "Failed to submit answer",
        variant: "destructive",
      });
      setIsSubmittingAnswer(false);
    }
  };

  const generateSmartQuestion = (type: string, difficulty: string) => {
    generateQuestionMutation.mutate({ type, difficulty });
  };

  const generateSummary = () => {
    generateSummaryMutation.mutate();
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

  const generateFromResume = async () => {
    if (!resumeFile) {
      toast({
        title: "Error",
        description: "No resume file uploaded",
        variant: "destructive",
      });
      return;
    }
    
    setIsGeneratingFromProfile(true);
    generateFromResumeMutation.mutate(resumeFile);
  };

  const generateFromGitHub = async () => {
    if (!githubUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a GitHub URL",
        variant: "destructive",
      });
      return;
    }
    
    setIsGeneratingFromProfile(true);
    const username = githubUrl.split('/').pop() || '';
    generateFromGitHubMutation.mutate(username);
  };

  const generateFromLinkedIn = async () => {
    if (!linkedinUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a LinkedIn URL",
        variant: "destructive",
      });
      return;
    }
    
    setIsGeneratingFromProfile(true);
    generateFromLinkedInMutation.mutate(linkedinUrl);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "question":
        return (
          <div className="p-4 space-y-4 h-full overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Current Question
                </CardTitle>
              </CardHeader>
              <CardContent>
                {interviewData.question ? (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Badge variant="secondary">{interviewData.questionType}</Badge>
                      <Badge variant="outline">{interviewData.difficulty}</Badge>
                    </div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg border">
                      {interviewData.question}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <MessageCircle className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                    <div className="text-sm">No question generated yet</div>
                    <div className="text-xs mt-1">Generate a question to get started</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
        
      case "history":
        return (
          <div className="p-4 h-full overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Question History
                  <Badge variant="outline" className="ml-auto">{questionHistory.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {questionHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <History className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                    <div className="text-sm">No questions generated yet</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {questionHistory.map((item) => (
                      <Card key={item.id} className="border border-gray-200">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex gap-2">
                              <Badge variant="secondary">{item.questionType}</Badge>
                              <Badge variant="outline">{item.difficulty}</Badge>
                            </div>
                            <span className="text-xs text-gray-500">{formatTimestamp(item.timestamp)}</span>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <Collapsible>
                            <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
                              <div className="text-sm text-gray-700">
                                {truncateQuestion(item.question, 100)}
                              </div>
                              <ChevronDown className="h-4 w-4" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2">
                              <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded border">
                                {item.question}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                          
                          {item.candidateCode && (
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-gray-600">Candidate Code:</div>
                              <div className="bg-gray-900 text-gray-100 p-3 rounded text-xs font-mono overflow-x-auto">
                                <pre className="whitespace-pre-wrap">{item.candidateCode}</pre>
                              </div>
                              
                              {item.aiFeedback && (
                                <Card className="bg-blue-50 border-blue-200">
                                  <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                      <div className="text-sm font-medium text-blue-900">AI Code Analysis</div>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="space-y-3">
                                    <div className="text-sm font-medium text-blue-900 mb-3">
                                      {item.aiFeedback.summary}
                                    </div>
                                    
                                    {/* Enhanced Scorecard */}
                                    <div className="bg-white rounded-lg p-3 border border-blue-200">
                                      <div className="text-xs font-semibold text-gray-600 mb-2">Performance Scores</div>
                                      <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                          <div className="flex justify-between items-center">
                                            <span className="text-xs text-gray-600">Correctness:</span>
                                            <div className="flex items-center gap-1">
                                              <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                <div 
                                                  className="h-full bg-green-500 rounded-full" 
                                                  style={{ width: `${(item.aiFeedback.scores.correctness / 10) * 100}%` }}
                                                />
                                              </div>
                                              <span className="text-xs font-semibold text-gray-800">{item.aiFeedback.scores.correctness}/10</span>
                                            </div>
                                          </div>
                                          <div className="flex justify-between items-center">
                                            <span className="text-xs text-gray-600">Quality:</span>
                                            <div className="flex items-center gap-1">
                                              <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                <div 
                                                  className="h-full bg-blue-500 rounded-full" 
                                                  style={{ width: `${(item.aiFeedback.scores.quality / 10) * 100}%` }}
                                                />
                                              </div>
                                              <span className="text-xs font-semibold text-gray-800">{item.aiFeedback.scores.quality}/10</span>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="space-y-2">
                                          <div className="flex justify-between items-center">
                                            <span className="text-xs text-gray-600">Efficiency:</span>
                                            <div className="flex items-center gap-1">
                                              <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                <div 
                                                  className="h-full bg-orange-500 rounded-full" 
                                                  style={{ width: `${(item.aiFeedback.scores.efficiency / 10) * 100}%` }}
                                                />
                                              </div>
                                              <span className="text-xs font-semibold text-gray-800">{item.aiFeedback.scores.efficiency}/10</span>
                                            </div>
                                          </div>
                                          <div className="flex justify-between items-center">
                                            <span className="text-xs text-gray-600">Readability:</span>
                                            <div className="flex items-center gap-1">
                                              <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                <div 
                                                  className="h-full bg-purple-500 rounded-full" 
                                                  style={{ width: `${(item.aiFeedback.scores.readability / 10) * 100}%` }}
                                                />
                                              </div>
                                              <span className="text-xs font-semibold text-gray-800">{item.aiFeedback.scores.readability}/10</span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {/* Overall Score */}
                                      <div className="mt-3 pt-3 border-t border-gray-200">
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm font-medium text-gray-800">Overall Score:</span>
                                          <div className="flex items-center gap-2">
                                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                              <div 
                                                className="h-full bg-indigo-600 rounded-full" 
                                                style={{ width: `${(item.aiFeedback.scores.overall / 10) * 100}%` }}
                                              />
                                            </div>
                                            <span className="text-sm font-bold text-indigo-600">{item.aiFeedback.scores.overall}/10</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Suggestion Section */}
                                    {item.aiFeedback.suggestion && (
                                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                        <div className="text-xs font-semibold text-amber-800 mb-1">💡 Improvement Suggestion</div>
                                        <div className="text-xs text-amber-700">{item.aiFeedback.suggestion}</div>
                                      </div>
                                    )}
                                    
                                    <Collapsible>
                                      <CollapsibleTrigger className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 font-medium">
                                        <Brain className="h-3 w-3" />
                                        View Full Analysis
                                        <ChevronRight className="h-3 w-3" />
                                      </CollapsibleTrigger>
                                      <CollapsibleContent className="mt-2">
                                        <div className="text-xs text-blue-700 whitespace-pre-wrap bg-white p-3 rounded border border-blue-200">
                                          {item.aiFeedback.fullExplanation}
                                        </div>
                                      </CollapsibleContent>
                                    </Collapsible>
                                  </CardContent>
                                </Card>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
        
      case "resume":
        return (
          <div className="p-4 h-full overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Resume Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!resumeFile ? (
                  <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                    <FileText className="h-12 w-12 text-gray-400 mb-4" />
                    <div className="text-gray-600 font-medium mb-4">Upload Resume</div>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="resume-upload"
                    />
                    <Button asChild>
                      <label htmlFor="resume-upload" className="cursor-pointer">
                        Choose PDF File
                      </label>
                    </Button>
                    <p className="text-xs text-gray-500 mt-2">PDF files only</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-gray-600" />
                        <div>
                          <div className="font-medium text-sm">{resumeFile.name}</div>
                          <div className="text-xs text-gray-500">
                            {(resumeFile.size / 1024 / 1024).toFixed(2)} MB
                          </div>
                        </div>
                      </div>
                      <Button variant="destructive" size="sm" onClick={clearResume}>
                        Remove
                      </Button>
                    </div>
                    
                    {resumeUrl && (
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <iframe
                          src={resumeUrl}
                          className="w-full h-96"
                          title="Resume Preview"
                        />
                      </div>
                    )}
                    
                    <Button
                      onClick={generateFromResume}
                      disabled={isGeneratingFromProfile}
                      className="w-full bg-orange-600 hover:bg-orange-700"
                    >
                      {isGeneratingFromProfile ? "Generating..." : "Generate Questions from Resume"}
                    </Button>
                  </div>
                )}
                
                {/* Generated Questions Section */}
                {generatedResumeQuestions.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-800">Generated Questions</h3>
                      <Badge variant="secondary">{generatedResumeQuestions.length} questions</Badge>
                    </div>
                    <div className="space-y-4">
                      {generatedResumeQuestions.map((question, index) => (
                        <Card key={index} className="border border-orange-200 bg-orange-50">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-orange-800 mb-2">Question {index + 1}</div>
                                <div className="text-sm text-gray-700 whitespace-pre-wrap">{question}</div>
                              </div>
                              <Button
                                onClick={() => updateQuestion(question, "Resume Analysis", "Medium")}
                                size="sm"
                                variant="outline"
                                className="border-orange-300 text-orange-700 hover:bg-orange-100"
                              >
                                Use This
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
        
      case "github":
        return (
          <div className="p-4 h-full overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Github className="h-5 w-5" />
                  GitHub Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    GitHub Profile URL
                  </label>
                  <input
                    type="text"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/username"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                
                <Button
                  onClick={generateFromGitHub}
                  disabled={isGeneratingFromProfile || !githubUrl.trim()}
                  className="w-full bg-gray-700 hover:bg-gray-800"
                >
                  {isGeneratingFromProfile ? "Generating..." : "Generate Questions from GitHub"}
                </Button>
                
                {/* Generated Questions Section */}
                {generatedGitHubQuestions.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-800">Generated Questions</h3>
                      <Badge variant="secondary">{generatedGitHubQuestions.length} questions</Badge>
                    </div>
                    <div className="space-y-4">
                      {generatedGitHubQuestions.map((question, index) => (
                        <Card key={index} className="border border-gray-200 bg-gray-50">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-800 mb-2">Question {index + 1}</div>
                                <div className="text-sm text-gray-700 whitespace-pre-wrap">{question}</div>
                              </div>
                              <Button
                                onClick={() => updateQuestion(question, "GitHub Analysis", "Medium")}
                                size="sm"
                                variant="outline"
                                className="border-gray-300 text-gray-700 hover:bg-gray-100"
                              >
                                Use This
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
        
      case "linkedin":
        return (
          <div className="p-4 h-full overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Linkedin className="h-5 w-5" />
                  LinkedIn Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    LinkedIn Profile URL
                  </label>
                  <input
                    type="text"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/username"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                
                <Button
                  onClick={generateFromLinkedIn}
                  disabled={isGeneratingFromProfile || !linkedinUrl.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {isGeneratingFromProfile ? "Generating..." : "Generate Questions from LinkedIn"}
                </Button>
                
                {/* Generated Questions Section */}
                {generatedLinkedInQuestions.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-800">Generated Questions</h3>
                      <Badge variant="secondary">{generatedLinkedInQuestions.length} questions</Badge>
                    </div>
                    <div className="space-y-4">
                      {generatedLinkedInQuestions.map((question, index) => (
                        <Card key={index} className="border border-blue-200 bg-blue-50">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-blue-800 mb-2">Question {index + 1}</div>
                                <div className="text-sm text-gray-700 whitespace-pre-wrap">{question}</div>
                              </div>
                              <Button
                                onClick={() => updateQuestion(question, "LinkedIn Analysis", "Medium")}
                                size="sm"
                                variant="outline"
                                className="border-blue-300 text-blue-700 hover:bg-blue-100"
                              >
                                Use This
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="h-screen w-screen flex gap-6 p-4 bg-gray-50">
      {/* Left Panel - Video Call */}
      <div className="w-64 h-full bg-white rounded-xl shadow-md border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Video className="h-4 w-4" />
            Video Call
          </h2>
        </div>
        <div className="p-4 h-full">
          {roomId ? (
            <VideoCall roomId={roomId} role={role || "guest"} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <Video className="h-8 w-8 mb-2 text-gray-400" />
              <div className="text-sm">No Room ID</div>
            </div>
          )}
        </div>
      </div>

      {/* Middle Panel - Code Editor */}
      <div className={`flex flex-col gap-4 ${isInterviewer ? 'w-[35%]' : 'w-[45%]'}`}>
        {/* Generate Controls - Only show for interviewer */}
        {isInterviewer && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Interview Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="Coding">Coding</option>
                  <option value="Algorithm">Algorithm</option>
                  <option value="System Design">System Design</option>
                  <option value="Data Structures">Data Structures</option>
                </select>
                
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => generateSmartQuestion(questionType, difficulty)}
                  disabled={generateQuestionMutation.isPending}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  {generateQuestionMutation.isPending ? "⏳" : "✨"} Generate
                </Button>
                
                <Button
                  onClick={generateSummary}
                  disabled={generateSummaryMutation.isPending}
                  variant="outline"
                >
                  {generateSummaryMutation.isPending ? "⏳" : "🧠"} Summary
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        <Card className="flex-1 flex flex-col">
          <CardHeader className="pb-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Code className="h-5 w-5" />
                Code Editor
              </CardTitle>
              {/* Submit Answer Button - Only for candidates */}
              {isCandidate && interviewData.question && (
                <Button
                  onClick={handleSubmitAnswer}
                  disabled={isSubmittingAnswer || !syncedCode.trim()}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isSubmittingAnswer ? "⏳" : "✅"} 
                  {isSubmittingAnswer ? "Analyzing..." : "Submit Answer"}
                </Button>
              )}
            </div>
            {isCodeSyncing && (
              <div className="text-xs text-blue-600 flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                Syncing...
              </div>
            )}
          </CardHeader>
          <CardContent className="p-4 flex-1 min-h-0">
            <div className="h-full w-full rounded-lg overflow-hidden border">
              <MonacoEditor
                value={syncedCode}
                language="javascript"
                theme="vs"
                onChange={handleCodeChange}
              />
            </div>
          </CardContent>
        </Card>
        
        {/* Summary Card */}
        {generatedSummary && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Code Feedback Summary</CardTitle>
                <Button
                  onClick={() => setGeneratedSummary("")}
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                >
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-600 whitespace-pre-wrap max-h-32 overflow-y-auto">
                {generatedSummary}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right Panel - Tabbed Interface */}
      <div className={`bg-white rounded-xl shadow-md border border-gray-200 ${isInterviewer ? 'flex-1' : 'flex-1'}`}>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)} className="h-full flex flex-col">
          <div className="border-b border-gray-200 p-4">
            {isInterviewer ? (
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="question" className="flex items-center gap-1">
                  <MessageCircle className="h-4 w-4" />
                  Question
                </TabsTrigger>
                <TabsTrigger value="history" className="flex items-center gap-1">
                  <History className="h-4 w-4" />
                  History
                </TabsTrigger>
                <TabsTrigger value="resume" className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  Resume
                </TabsTrigger>
                <TabsTrigger value="github" className="flex items-center gap-1">
                  <Github className="h-4 w-4" />
                  GitHub
                </TabsTrigger>
                <TabsTrigger value="linkedin" className="flex items-center gap-1">
                  <Linkedin className="h-4 w-4" />
                  LinkedIn
                </TabsTrigger>
              </TabsList>
            ) : (
              <div className="text-center">
                <h2 className="text-lg font-bold text-gray-800 flex items-center justify-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Current Question
                </h2>
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-hidden">
            {isCandidate ? (
              // Candidates only see the current question with enhanced spacing
              <div className="p-6 h-full overflow-y-auto">
                <Card className="h-full">
                  <CardContent className="pt-6 h-full flex flex-col">
                    {interviewData.question ? (
                      <div className="space-y-4 flex-1">
                        <div className="text-base text-gray-800 whitespace-pre-wrap bg-gray-50 p-6 rounded-lg border leading-relaxed flex-1">
                          {interviewData.question}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500 flex-1 flex flex-col justify-center">
                        <MessageCircle className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                        <div className="text-base font-medium mb-2">Waiting for Question</div>
                        <div className="text-sm text-gray-400">The interviewer will generate a question for you to solve</div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              // Interviewers see full tabbed interface
              renderTabContent()
            )}
          </div>
        </Tabs>
      </div>
    </div>
  );
}