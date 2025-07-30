import { useState, useEffect } from "react";
import { MonacoEditor } from "@/components/monaco-editor";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams } from "wouter";
import { useInterviewRoom, QuestionHistory, JobContext, useSentQuestions, SentQuestion } from "@/hooks/useFirestore";
import { useCodeSync } from "@/hooks/useCodeSync";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, Github, Linkedin, MessageCircle, MessageSquare, History, ChevronDown, ChevronRight, Code, Brain, Video, Briefcase, Settings, Volume2, BarChart3 } from "lucide-react";
import { VideoCall } from "@/components/video-call";

import { CompleteInterviewButton } from "@/components/CompleteInterviewButton";
import { SpeechTranscription } from "@/components/SpeechTranscription";
import { TranscriptViewer } from "@/components/TranscriptViewer";
import { QuestionTimeline } from "@/components/QuestionTimeline";
import { InterviewCompletion } from "@/components/InterviewCompletion";
import { CompletedInterviewView } from "@/components/CompletedInterviewView";
import { TemplateManager } from "@/components/TemplateManager";
import { ConsentScreen } from "@/components/ConsentScreen";
import { PerformanceSidebar } from "@/components/PerformanceSidebar";
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import html2pdf from 'html2pdf.js';

type TabType = "question" | "history" | "resume" | "github" | "linkedin" | "feedback" | "live-questions" | "transcript";

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
  const [activeTab, setActiveTab] = useState<TabType>("question");
  const [generatedSummary, setGeneratedSummary] = useState<string>("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeUrl, setResumeUrl] = useState<string>("");
  const [githubUrl, setGithubUrl] = useState<string>("");
  const [linkedinUrl, setLinkedinUrl] = useState<string>("");
  const [questionType, setQuestionType] = useState<string>("Coding");
  const [difficulty, setDifficulty] = useState<string>("Medium");
  const [customTopic, setCustomTopic] = useState<string>("");
  const [isGeneratingFromProfile, setIsGeneratingFromProfile] = useState<boolean>(false);
  
  // Consent management for candidates
  const [consentGiven, setConsentGiven] = useState<boolean>(false);
  const [consentLoading, setConsentLoading] = useState<boolean>(true);
  
  // Unified sidebar state - either 'timeline', 'performance', or 'closed'
  const [activeSidebar, setActiveSidebar] = useState<'timeline' | 'performance' | 'closed'>('closed');
  
  // UI animations state
  const [showSendSuccess, setShowSendSuccess] = useState<boolean>(false);
  
  // Generated questions for each source
  const [generatedResumeQuestions, setGeneratedResumeQuestions] = useState<string[]>([]);
  const [generatedGitHubQuestions, setGeneratedGitHubQuestions] = useState<string[]>([]);
  const [generatedLinkedInQuestions, setGeneratedLinkedInQuestions] = useState<string[]>([]);
  
  // Job context state
  const [jobContext, setJobContext] = useState<JobContext | null>(null);
  const [showJobContextDialog, setShowJobContextDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [hasCheckedJobContext, setHasCheckedJobContext] = useState(false);
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const [isInterviewCompleted, setIsInterviewCompleted] = useState(false);
  
  // Firebase Firestore integration
  const { data: interviewData, loading: firestoreLoading, error: firestoreError, updateQuestion, updateSummary, getQuestionHistory, updateQuestionWithCode, saveJobContext, getJobContext, updateInterviewData, sendQuestionToCandidate, getSentQuestions } = useInterviewRoom(roomId || "");
  
  // Real-time sent questions for candidates
  const { sentQuestions, loading: sentQuestionsLoading } = useSentQuestions(roomId || "");
  
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

  // Function to highlight topic in question text
  const highlightTopic = (text: string, topic: string) => {
    if (!topic.trim()) return text;
    
    const regex = new RegExp(`(${topic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<strong>$1</strong>');
  };

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

  // Load job context when component mounts
  useEffect(() => {
    const loadJobContext = async () => {
      if (roomId && !hasCheckedJobContext) {
        const context = await getJobContext();
        setJobContext(context);
        setHasCheckedJobContext(true);
        if (!context && isInterviewer) {
          setShowJobContextDialog(true);
        }
      }
    };
    loadJobContext();
  }, [roomId, getJobContext, isInterviewer, hasCheckedJobContext]);

  // Check consent status for candidates
  useEffect(() => {
    if (isCandidate && roomId) {
      const checkConsent = async () => {
        try {
          const response = await apiRequest(`/api/interviews/${roomId}/consent`, 'GET');
          setConsentGiven(response.consentGiven || false);
        } catch (error) {
          console.error('Error checking consent:', error);
          setConsentGiven(false);
        } finally {
          setConsentLoading(false);
        }
      };
      
      checkConsent();
    } else {
      // Interviewers don't need consent
      setConsentGiven(true);
      setConsentLoading(false);
    }
  }, [isCandidate, roomId]);

  // Monitor interview completion status
  useEffect(() => {
    if (interviewData && (interviewData as any).status === 'completed') {
      setIsInterviewCompleted(true);
    }
  }, [interviewData]);

  // Handle consent given
  const handleConsentGiven = () => {
    setConsentGiven(true);
  };

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
    mutationFn: async ({ type, difficulty, jobContext, topic }: { type: string; difficulty: string; jobContext?: JobContext | null; topic?: string }) => {
      return apiRequest("/api/generate-question", "POST", { type, difficulty, roomId, jobContext, topic });
    },
    onSuccess: async (data: { question: string }) => {
      await updateQuestion(data.question, questionType, difficulty);
      // Switch to question tab to show the generated question
      setActiveTab("question");
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
      setActiveTab("feedback"); // Automatically switch to feedback tab
      toast({
        title: "Summary Generated",
        description: "Code analysis summary has been generated. Check the Feedback tab.",
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

  const sendToCandidateMutation = useMutation({
    mutationFn: async ({ question, questionType, difficulty }: { question: string; questionType: string; difficulty: string }) => {
      await sendQuestionToCandidate(question, questionType, difficulty);
      return { success: true };
    },
    onSuccess: () => {
      // Show success animation
      setShowSendSuccess(true);
      setTimeout(() => setShowSendSuccess(false), 2000);
      
      toast({
        title: "✅ Question Sent Successfully",
        description: "The question is now live in the candidate's panel.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to send question to candidate. Please try again.",
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

  const generateSmartQuestion = (type: string, difficulty: string, topic?: string) => {
    generateQuestionMutation.mutate({ type, difficulty, jobContext, topic });
  };

  // Job Context Setup Functions
  const handleJobContextSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    const newJobContext: JobContext = {
      jobTitle: formData.get('jobTitle') as string,
      techStack: formData.get('techStack') as string,
      seniorityLevel: formData.get('seniorityLevel') as 'Junior' | 'Mid' | 'Senior',
      roleType: formData.get('roleType') as 'Coding' | 'Behavioral' | 'System Design',
    };

    await saveJobContext(newJobContext);
    setJobContext(newJobContext);
    setShowJobContextDialog(false);
    
    toast({
      title: "Job Context Saved",
      description: "Interview questions will now be personalized for this role.",
    });
  };

  const generateSummary = () => {
    generateSummaryMutation.mutate();
  };

  // Export report mutations
  const exportReportMutation = useMutation({
    mutationFn: async ({ format, candidateName, candidateEmail, companyName }: { 
      format: 'pdf' | 'email'; 
      candidateName: string; 
      candidateEmail: string; 
      companyName: string;
    }) => {
      return apiRequest("/api/export-report", "POST", { 
        roomId, 
        format, 
        candidateName, 
        candidateEmail, 
        companyName 
      });
    },
    onSuccess: (data) => {
      if (data.format === 'pdf' && data.htmlContent) {
        console.log('HTML Content received:', data.htmlContent.substring(0, 500));
        
        // Create a temporary iframe to properly render the HTML
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.left = '-9999px';
        iframe.style.top = '-9999px';
        iframe.style.width = '800px';
        iframe.style.height = '600px';
        document.body.appendChild(iframe);

        // Write the HTML content to the iframe
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          iframeDoc.open();
          iframeDoc.write(data.htmlContent);
          iframeDoc.close();

          // Wait for content to load then generate PDF
          setTimeout(() => {
            const options = {
              margin: 10,
              filename: `interview-report-${candidateName.replace(/\s+/g, '-')}.pdf`,
              image: { type: 'jpeg', quality: 0.98 },
              html2canvas: { 
                scale: 1.5,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                scrollX: 0,
                scrollY: 0
              },
              jsPDF: { 
                unit: 'mm', 
                format: 'a4', 
                orientation: 'portrait'
              }
            };

            html2pdf()
              .set(options)
              .from(iframeDoc.body)
              .save()
              .then(() => {
                document.body.removeChild(iframe);
                console.log('PDF generated successfully');
              })
              .catch((error: any) => {
                console.error('PDF generation error:', error);
                document.body.removeChild(iframe);
                toast({
                  title: "PDF Generation Failed",
                  description: "There was an issue generating the PDF. Please try again.",
                  variant: "destructive",
                });
              });
          }, 1000); // Wait for styles to load
        }
      }
      toast({
        title: "Report Generated",
        description: data.format === 'pdf' ? "PDF report is being generated..." : "Report sent via email",
      });
      setShowExportDialog(false);
      setIsGeneratingReport(false);
    },
    onError: (error) => {
      toast({
        title: "Export Failed",
        description: "Failed to generate report. Please try again.",
        variant: "destructive",
      });
      setIsGeneratingReport(false);
    }
  });

  const handleExportReport = (format: 'pdf' | 'email') => {
    if (!candidateName.trim() || !companyName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in candidate name and company name.",
        variant: "destructive",
      });
      return;
    }

    if (format === 'email' && !candidateEmail.trim()) {
      toast({
        title: "Missing Email",
        description: "Please provide candidate email for email delivery.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingReport(true);
    exportReportMutation.mutate({ 
      format, 
      candidateName, 
      candidateEmail, 
      companyName 
    });
  };

  // End Interview functionality
  const endInterviewMutation = useMutation({
    mutationFn: async () => {
      const interviewData = {
        roomId,
        candidateName: candidateName || "Unnamed Candidate",
        candidateId: `candidate_${roomId}`,
        roleTitle: jobContext?.jobTitle || "Software Engineer",
        roundNumber: 1,
        interviewerName: "Interviewer", // Could be made dynamic
        timestamp: Date.now(),
        status: "Completed",
        jobContext: jobContext || {
          jobTitle: "Software Engineer",
          techStack: "General",
          seniorityLevel: "Mid",
          roleType: "Coding"
        },
        questions: questionHistory,
        currentCode: syncedCode,
        overallSummary: generatedSummary,
        date: new Date().toLocaleDateString()
      };

      // Save to Firestore
      await updateInterviewData(interviewData);
      
      return interviewData;
    },
    onSuccess: () => {
      toast({
        title: "Interview Ended",
        description: "Interview ended and saved successfully!",
      });
      // Redirect to dashboard
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1000);
    },
    onError: (error) => {
      console.error("Failed to end interview:", error);
      toast({
        title: "Save Failed",
        description: "Failed to save interview. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleEndInterview = async () => {
    // Generate final AI summary if not already done
    if (!generatedSummary && questionHistory.length > 0) {
      try {
        const summaryResponse = await generateSummaryMutation.mutateAsync();
        setGeneratedSummary(summaryResponse.summary);
      } catch (error) {
        console.warn("Failed to generate final summary:", error);
      }
    }
    
    // End the interview and save all data
    endInterviewMutation.mutate();
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
                    <div 
                      className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg border"
                      dangerouslySetInnerHTML={{
                        __html: highlightTopic(interviewData.question, customTopic)
                      }}
                    />
                    <div className="flex justify-end mt-4">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => sendToCandidateMutation.mutate({
                              question: interviewData.question || "",
                              questionType: interviewData.questionType || "General",
                              difficulty: interviewData.difficulty || "Medium"
                            })}
                            disabled={sendToCandidateMutation.isPending}
                            className={`bg-violet-600 hover:bg-violet-700 text-white transition-all duration-300 ${
                              showSendSuccess ? "bg-green-600 animate-pulse" : "hover:scale-105"
                            }`}
                          >
                            {sendToCandidateMutation.isPending ? "⏳ Sending..." : 
                             showSendSuccess ? "✅ Sent!" : "📤 Send to Candidate"}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Send this question to the candidate's live panel</p>
                        </TooltipContent>
                      </Tooltip>
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

      case "transcript":
        return (
          <div className="p-4 h-full overflow-y-auto">
            <TranscriptViewer
              roomId={roomId || ""}
              questionId={interviewData.question ? "current-question" : undefined}
              currentQuestion={interviewData.question || undefined}
            />
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
                                    
                                    {/* Enhanced Scorecard with Weighted Scoring */}
                                    <div className="bg-white rounded-lg p-3 border border-blue-200">
                                      <div className="text-xs font-semibold text-gray-600 mb-2">Performance Scores (Weighted)</div>
                                      <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                          <div className="flex justify-between items-center">
                                            <span className="text-xs text-gray-600">Correctness (30%):</span>
                                            <div className="flex items-center gap-1">
                                              <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                <div 
                                                  className="h-full bg-green-500 rounded-full" 
                                                  style={{ width: `${(item.aiFeedback.scores.correctness / 10) * 100}%` }}
                                                />
                                              </div>
                                              <span className="text-xs font-semibold text-gray-800">{item.aiFeedback.scores.correctness}/10</span>
                                              <span className="text-xs">
                                                {item.aiFeedback.scores.correctness >= 7 ? '✅' : 
                                                 item.aiFeedback.scores.correctness < 5 ? '⚠️' : '📊'}
                                              </span>
                                            </div>
                                          </div>
                                          <div className="flex justify-between items-center">
                                            <span className="text-xs text-gray-600">Relevance (30%):</span>
                                            <div className="flex items-center gap-1">
                                              <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                <div 
                                                  className="h-full bg-indigo-500 rounded-full" 
                                                  style={{ width: `${((item.aiFeedback.scores.relevance || item.aiFeedback.scores.correctness) / 10) * 100}%` }}
                                                />
                                              </div>
                                              <span className="text-xs font-semibold text-gray-800">{item.aiFeedback.scores.relevance || item.aiFeedback.scores.correctness}/10</span>
                                              <span className="text-xs">
                                                {(item.aiFeedback.scores.relevance || item.aiFeedback.scores.correctness) >= 7 ? '✅' : 
                                                 (item.aiFeedback.scores.relevance || item.aiFeedback.scores.correctness) < 5 ? '⚠️' : '📊'}
                                              </span>
                                            </div>
                                          </div>
                                          <div className="flex justify-between items-center">
                                            <span className="text-xs text-gray-600">Quality (10%):</span>
                                            <div className="flex items-center gap-1">
                                              <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                <div 
                                                  className="h-full bg-blue-500 rounded-full" 
                                                  style={{ width: `${(item.aiFeedback.scores.quality / 10) * 100}%` }}
                                                />
                                              </div>
                                              <span className="text-xs font-semibold text-gray-800">{item.aiFeedback.scores.quality}/10</span>
                                              <span className="text-xs">
                                                {item.aiFeedback.scores.quality >= 7 ? '✅' : 
                                                 item.aiFeedback.scores.quality < 5 ? '⚠️' : '📊'}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="space-y-2">
                                          <div className="flex justify-between items-center">
                                            <span className="text-xs text-gray-600">Efficiency (15%):</span>
                                            <div className="flex items-center gap-1">
                                              <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                <div 
                                                  className="h-full bg-orange-500 rounded-full" 
                                                  style={{ width: `${(item.aiFeedback.scores.efficiency / 10) * 100}%` }}
                                                />
                                              </div>
                                              <span className="text-xs font-semibold text-gray-800">{item.aiFeedback.scores.efficiency}/10</span>
                                              <span className="text-xs">
                                                {item.aiFeedback.scores.efficiency >= 7 ? '✅' : 
                                                 item.aiFeedback.scores.efficiency < 5 ? '⚠️' : '📊'}
                                              </span>
                                            </div>
                                          </div>
                                          <div className="flex justify-between items-center">
                                            <span className="text-xs text-gray-600">Readability (15%):</span>
                                            <div className="flex items-center gap-1">
                                              <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                <div 
                                                  className="h-full bg-purple-500 rounded-full" 
                                                  style={{ width: `${(item.aiFeedback.scores.readability / 10) * 100}%` }}
                                                />
                                              </div>
                                              <span className="text-xs font-semibold text-gray-800">{item.aiFeedback.scores.readability}/10</span>
                                              <span className="text-xs">
                                                {item.aiFeedback.scores.readability >= 7 ? '✅' : 
                                                 item.aiFeedback.scores.readability < 5 ? '⚠️' : '📊'}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {/* Overall Score with Assessment */}
                                      <div className="mt-3 pt-3 border-t border-gray-200">
                                        <div className="flex justify-between items-center mb-2">
                                          <span className="text-sm font-medium text-gray-800">Weighted Overall Score:</span>
                                          <div className="flex items-center gap-2">
                                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                              <div 
                                                className="h-full bg-indigo-600 rounded-full" 
                                                style={{ width: `${(item.aiFeedback.scores.overall / 10) * 100}%` }}
                                              />
                                            </div>
                                            <span className="text-sm font-bold text-indigo-600">{item.aiFeedback.scores.overall}/10</span>
                                            <span className="text-sm">
                                              {item.aiFeedback.scores.overall >= 7 ? '✅' : 
                                               item.aiFeedback.scores.overall < 5 ? '⚠️' : '📊'}
                                            </span>
                                          </div>
                                        </div>
                                        {/* AI Assessment Note */}
                                        {item.aiFeedback.scoreNote && (
                                          <div className={`text-xs px-2 py-1 rounded-full text-center font-medium ${
                                            item.aiFeedback.scores.overall < 3 
                                              ? 'bg-red-100 text-red-700' 
                                              : item.aiFeedback.scores.overall < 5 
                                              ? 'bg-yellow-100 text-yellow-700'
                                              : item.aiFeedback.scores.overall < 7 
                                              ? 'bg-blue-100 text-blue-700'
                                              : 'bg-green-100 text-green-700'
                                          }`}>
                                            <span className="mr-1">
                                              {item.aiFeedback.scores.overall < 5 ? '⚠️' : 
                                               item.aiFeedback.scores.overall >= 7 ? '✅' : '📊'}
                                            </span>
                                            {item.aiFeedback.scoreNote}
                                          </div>
                                        )}
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
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={generateFromResume}
                          disabled={isGeneratingFromProfile}
                          className="w-full bg-orange-600 hover:bg-orange-700 transition-all duration-200 hover:scale-105"
                        >
                          {isGeneratingFromProfile ? "Generating..." : "📄 Generate Questions from Resume"}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Analyze uploaded resume to create personalized interview questions</p>
                      </TooltipContent>
                    </Tooltip>
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
                              <div className="flex flex-col gap-2">
                                <Button
                                  onClick={() => updateQuestion(question, "Resume Analysis", "Medium")}
                                  size="sm"
                                  variant="outline"
                                  className="border-orange-300 text-orange-700 hover:bg-orange-100"
                                >
                                  Use This
                                </Button>
                                {isInterviewer && (
                                  <Button
                                    onClick={() => sendToCandidateMutation.mutate({
                                      question,
                                      questionType: "Resume Analysis",
                                      difficulty: "Medium"
                                    })}
                                    size="sm"
                                    disabled={sendToCandidateMutation.isPending}
                                    className="bg-orange-600 hover:bg-orange-700 text-white"
                                  >
                                    {sendToCandidateMutation.isPending ? "Sending..." : "Send to Candidate"}
                                  </Button>
                                )}
                              </div>
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
                              <div className="flex flex-col gap-2">
                                <Button
                                  onClick={() => updateQuestion(question, "GitHub Analysis", "Medium")}
                                  size="sm"
                                  variant="outline"
                                  className="border-gray-300 text-gray-700 hover:bg-gray-100"
                                >
                                  Use This
                                </Button>
                                {isInterviewer && (
                                  <Button
                                    onClick={() => sendToCandidateMutation.mutate({
                                      question,
                                      questionType: "GitHub Analysis",
                                      difficulty: "Medium"
                                    })}
                                    size="sm"
                                    disabled={sendToCandidateMutation.isPending}
                                    className="bg-gray-700 hover:bg-gray-800 text-white"
                                  >
                                    {sendToCandidateMutation.isPending ? "Sending..." : "Send to Candidate"}
                                  </Button>
                                )}
                              </div>
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
                    LinkedIn Profile Information
                  </label>
                  <textarea
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="Paste your LinkedIn profile text here... Include headline, summary, experience, skills, etc."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-vertical"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Copy and paste text from your LinkedIn profile for accurate question generation
                  </div>
                </div>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={generateFromLinkedIn}
                      disabled={isGeneratingFromProfile || !linkedinUrl.trim()}
                      className="w-full bg-blue-600 hover:bg-blue-700 transition-all duration-200 hover:scale-105"
                    >
                      {isGeneratingFromProfile ? "Generating..." : "🔗 Generate Questions from LinkedIn"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Analyze LinkedIn profile to generate role-specific interview questions</p>
                  </TooltipContent>
                </Tooltip>
                
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
                              <div className="flex flex-col gap-2">
                                <Button
                                  onClick={() => updateQuestion(question, "LinkedIn Analysis", "Medium")}
                                  size="sm"
                                  variant="outline"
                                  className="border-blue-300 text-blue-700 hover:bg-blue-100"
                                >
                                  Use This
                                </Button>
                                {isInterviewer && (
                                  <Button
                                    onClick={() => sendToCandidateMutation.mutate({
                                      question,
                                      questionType: "LinkedIn Analysis",
                                      difficulty: "Medium"
                                    })}
                                    size="sm"
                                    disabled={sendToCandidateMutation.isPending}
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                  >
                                    {sendToCandidateMutation.isPending ? "Sending..." : "Send to Candidate"}
                                  </Button>
                                )}
                              </div>
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
        
      case "feedback":
        return (
          <div className="p-4 h-full overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Code Feedback Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                {generatedSummary ? (
                  <div className="space-y-4">
                    <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg border leading-relaxed">
                      {generatedSummary}
                    </div>
                    
                    {/* Enhanced feedback section with scores and indicators */}
                    {questionHistory.length > 0 && questionHistory[0].aiFeedback && (
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-gray-800">Performance Metrics</h4>
                          <div className="flex items-center gap-2">
                            <span className={`text-lg ${
                              questionHistory[0].aiFeedback.scores.overall < 5 ? '' : 
                              questionHistory[0].aiFeedback.scores.overall >= 7 ? '' : ''
                            }`}>
                              {questionHistory[0].aiFeedback.scores.overall < 5 ? '⚠️' : 
                               questionHistory[0].aiFeedback.scores.overall >= 7 ? '✅' : '📊'}
                            </span>
                            <span className="text-sm font-bold text-indigo-600">
                              {questionHistory[0].aiFeedback.scores.overall}/10
                            </span>
                          </div>
                        </div>
                        
                        {/* Detailed scores grid */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="text-xs">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Correctness (30%):</span>
                              <div className="flex items-center gap-1">
                                <span className="font-medium">{questionHistory[0].aiFeedback.scores.correctness}/10</span>
                                <span className="text-xs">
                                  {questionHistory[0].aiFeedback.scores.correctness >= 7 ? '✅' : 
                                   questionHistory[0].aiFeedback.scores.correctness < 5 ? '⚠️' : '📊'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-xs">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Relevance (30%):</span>
                              <div className="flex items-center gap-1">
                                <span className="font-medium">{questionHistory[0].aiFeedback.scores.relevance || questionHistory[0].aiFeedback.scores.correctness}/10</span>
                                <span className="text-xs">
                                  {(questionHistory[0].aiFeedback.scores.relevance || questionHistory[0].aiFeedback.scores.correctness) >= 7 ? '✅' : 
                                   (questionHistory[0].aiFeedback.scores.relevance || questionHistory[0].aiFeedback.scores.correctness) < 5 ? '⚠️' : '📊'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-xs">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Efficiency (15%):</span>
                              <div className="flex items-center gap-1">
                                <span className="font-medium">{questionHistory[0].aiFeedback.scores.efficiency}/10</span>
                                <span className="text-xs">
                                  {questionHistory[0].aiFeedback.scores.efficiency >= 7 ? '✅' : 
                                   questionHistory[0].aiFeedback.scores.efficiency < 5 ? '⚠️' : '📊'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-xs">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Readability (15%):</span>
                              <div className="flex items-center gap-1">
                                <span className="font-medium">{questionHistory[0].aiFeedback.scores.readability}/10</span>
                                <span className="text-xs">
                                  {questionHistory[0].aiFeedback.scores.readability >= 7 ? '✅' : 
                                   questionHistory[0].aiFeedback.scores.readability < 5 ? '⚠️' : '📊'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-xs">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Quality (10%):</span>
                              <div className="flex items-center gap-1">
                                <span className="font-medium">{questionHistory[0].aiFeedback.scores.quality}/10</span>
                                <span className="text-xs">
                                  {questionHistory[0].aiFeedback.scores.quality >= 7 ? '✅' : 
                                   questionHistory[0].aiFeedback.scores.quality < 5 ? '⚠️' : '📊'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* AI-generated verdict */}
                        {questionHistory[0].aiFeedback.scoreNote && (
                          <div className={`text-xs px-3 py-2 rounded-lg font-medium text-center ${
                            questionHistory[0].aiFeedback.scores.overall < 3 
                              ? 'bg-red-100 text-red-700' 
                              : questionHistory[0].aiFeedback.scores.overall < 5 
                              ? 'bg-yellow-100 text-yellow-700'
                              : questionHistory[0].aiFeedback.scores.overall < 7 
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            <span className="mr-1">
                              {questionHistory[0].aiFeedback.scores.overall < 5 ? '⚠️' : 
                               questionHistory[0].aiFeedback.scores.overall >= 7 ? '✅' : '📊'}
                            </span>
                            {questionHistory[0].aiFeedback.scoreNote}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <Button
                      onClick={() => setGeneratedSummary("")}
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      Clear Feedback
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Brain className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                    <div className="text-sm">No feedback summary available</div>
                    <div className="text-xs mt-1">Generate a summary to see AI feedback here</div>
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

  // Show completed interview view if interview is completed
  // Show consent screen for candidates who haven't given consent yet
  if (isCandidate && consentLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Checking consent status...</p>
        </div>
      </div>
    );
  }

  if (isCandidate && !consentGiven) {
    return <ConsentScreen roomId={roomId || ""} onConsentGiven={handleConsentGiven} />;
  }

  if (isInterviewCompleted) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Interview Summary & Results</h1>
            <div className="text-sm text-gray-600">Room ID: {roomId}</div>
          </div>
          <CompletedInterviewView roomId={roomId || ""} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex gap-6 p-4 bg-gray-50">
      {/* Left Panel - Video Call & Chat */}
      <div className="w-64 h-full bg-white rounded-xl shadow-md border border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Video className="h-4 w-4" />
            Video Call
          </h2>
        </div>
        <div className="p-4 flex-1 flex flex-col">
          {roomId ? (
            <VideoCall roomId={roomId} role={role || "guest"} />
          ) : (
            <div className="h-32 flex flex-col items-center justify-center text-gray-500">
              <Video className="h-8 w-8 mb-2 text-gray-400" />
              <div className="text-sm">No Room ID</div>
            </div>
          )}
        </div>
        

        
        {/* Complete Interview Button - Bottom Left */}
        {isInterviewer && (
          <div className="p-4 border-t border-gray-200">
            <CompleteInterviewButton 
              roomId={roomId || ""} 
              onInterviewCompleted={() => {
                setIsInterviewCompleted(true);
                toast({
                  title: "Interview Completed",
                  description: "Report generated and downloaded automatically",
                });
              }}
            />
          </div>
        )}
      </div>

      {/* Middle Panel - Code Editor */}
      <div className={`flex flex-col gap-4 ${isInterviewer ? 'w-[35%]' : 'w-[45%]'}`}>
        {/* Generate Controls - Only show for interviewer */}
        {isInterviewer && (
          <Card>
            <CardHeader className="pb-3">
              <div className="space-y-3">
                {/* Header with title and main action buttons */}
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Interview Controls
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {jobContext && (
                      <Badge variant="secondary" className="text-xs">
                        <Briefcase className="h-3 w-3 mr-1" />
                        {jobContext.seniorityLevel} {jobContext.jobTitle}
                      </Badge>
                    )}

                    <Dialog open={showJobContextDialog} onOpenChange={setShowJobContextDialog}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Setup Job Context</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleJobContextSave} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="jobTitle">Job Title</Label>
                          <Input
                            id="jobTitle"
                            name="jobTitle"
                            placeholder="e.g., Frontend Engineer"
                            defaultValue={jobContext?.jobTitle}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="techStack">Tech Stack (comma-separated)</Label>
                          <Input
                            id="techStack"
                            name="techStack"
                            placeholder="e.g., React, TypeScript, Node.js"
                            defaultValue={jobContext?.techStack}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="seniorityLevel">Seniority Level</Label>
                          <Select name="seniorityLevel" defaultValue={jobContext?.seniorityLevel || "Mid"}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select level" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Junior">Junior</SelectItem>
                              <SelectItem value="Mid">Mid</SelectItem>
                              <SelectItem value="Senior">Senior</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="roleType">Role Type</Label>
                          <Select name="roleType" defaultValue={jobContext?.roleType || "Coding"}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Coding">Coding</SelectItem>
                              <SelectItem value="Behavioral">Behavioral</SelectItem>
                              <SelectItem value="System Design">System Design</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setShowJobContextDialog(false)}>
                            Cancel
                          </Button>
                          <Button type="submit">Save Context</Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              
              {/* Sidebar Toggle Buttons Row */}
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => setActiveSidebar(activeSidebar === 'timeline' ? 'closed' : 'timeline')}
                      variant={activeSidebar === 'timeline' ? 'default' : 'outline'}
                      size="sm"
                      className={`transition-all duration-200 flex items-center gap-2 ${activeSidebar === 'timeline' ? 'bg-violet-600 hover:bg-violet-700 text-white' : ''}`}
                    >
                      <History className="h-4 w-4" />
                      Question Timeline
                      {questionHistory.length > 0 && (
                        <Badge variant="secondary" className="ml-1 h-4 w-4 p-0 text-xs">
                          {questionHistory.length}
                        </Badge>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Toggle question timeline and history view</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => setActiveSidebar(activeSidebar === 'performance' ? 'closed' : 'performance')}
                      variant={activeSidebar === 'performance' ? 'default' : 'outline'}
                      size="sm"
                      className={`transition-all duration-200 flex items-center gap-2 ${activeSidebar === 'performance' ? 'bg-violet-600 hover:bg-violet-700 text-white' : ''}`}
                    >
                      <BarChart3 className="h-4 w-4" />
                      AI Performance Scorecard
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Toggle AI performance scorecard with real-time analytics</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
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
                  <option value="Behavioral">Behavioral</option>
                  <option value="Psychometric">Psychometric</option>
                  <option value="Situational">Situational</option>
                  <option value="Technical Knowledge">Technical Knowledge</option>
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
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Topic (optional)</label>
                <input
                  type="text"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  placeholder="e.g. React useEffect, customer escalation, DSA arrays"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-center">
                  <TemplateManager 
                    currentJobContext={jobContext}
                    onLoadTemplate={(template) => {
                      // Map template values to job context compatible values
                      const mappedSeniorityLevel = template.seniorityLevel === 'Entry' ? 'Junior' : 
                                                   template.seniorityLevel === 'Staff' || template.seniorityLevel === 'Principal' ? 'Senior' : 
                                                   template.seniorityLevel as 'Junior' | 'Mid' | 'Senior';
                      
                      const mappedRoleType = ['Frontend', 'Backend', 'Fullstack', 'DevOps', 'Data Science', 'Mobile', 'QA', 'Product Manager'].includes(template.roleType) ? 'Coding' : 
                                           template.roleType.includes('Behavioral') ? 'Behavioral' : 
                                           'System Design';
                      
                      const newJobContext = {
                        jobTitle: template.jobTitle,
                        seniorityLevel: mappedSeniorityLevel,
                        roleType: mappedRoleType as 'Coding' | 'Behavioral' | 'System Design',
                        techStack: template.techStack,
                        department: template.department || ''
                      };
                      
                      setJobContext(newJobContext);
                      setQuestionType(template.defaultQuestionType);
                      setDifficulty(template.defaultDifficulty);
                      // Save loaded template as job context
                      saveJobContext(newJobContext);
                    }}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => generateSmartQuestion(questionType, difficulty, customTopic)}
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
              </div>
              
              <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline"
                    className="w-full border-green-600 text-green-600 hover:bg-green-50"
                  >
                    📤 Export Report
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Export Interview Report</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="candidateName">Candidate Name *</Label>
                      <Input
                        id="candidateName"
                        placeholder="Enter candidate's full name"
                        value={candidateName}
                        onChange={(e) => setCandidateName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="candidateEmail">Candidate Email</Label>
                      <Input
                        id="candidateEmail"
                        type="email"
                        placeholder="candidate@email.com"
                        value={candidateEmail}
                        onChange={(e) => setCandidateEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company Name *</Label>
                      <Input
                        id="companyName"
                        placeholder="Your company name"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setShowExportDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={() => handleExportReport('pdf')}
                        disabled={exportReportMutation.isPending}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        📄 Download PDF
                      </Button>
                      <Button 
                        onClick={() => handleExportReport('email')}
                        disabled={exportReportMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        ✉️ Email Report
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
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
        

      </div>

      {/* Right Panel - Tabbed Interface */}
      <div className={`bg-white rounded-xl shadow-md border border-gray-200 ${isInterviewer ? 'flex-1' : 'flex-1'}`}>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)} className="h-full flex flex-col">
          <div className="border-b border-gray-200 p-4">
            {isInterviewer ? (
              <TabsList className="grid w-full grid-cols-7 bg-gray-100">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger value="question" className="flex items-center gap-1 transition-all duration-200">
                      <MessageCircle className="h-4 w-4" />
                      Question
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Generate and manage interview questions</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger value="transcript" className="flex items-center gap-1 transition-all duration-200">
                      <Volume2 className="h-4 w-4" />
                      Speech
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent>View live speech transcription</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger value="history" className="flex items-center gap-1 transition-all duration-200">
                      <History className="h-4 w-4" />
                      History
                      {questionHistory.length > 0 && (
                        <Badge variant="secondary" className="ml-1 h-4 w-4 p-0 text-xs">
                          {questionHistory.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent>View question history and AI feedback</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger value="feedback" className="flex items-center gap-1 transition-all duration-200">
                      <Brain className="h-4 w-4" />
                      Feedback
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Generate AI-powered feedback summary</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger value="resume" className="flex items-center gap-1 transition-all duration-200">
                      <FileText className="h-4 w-4" />
                      Resume
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Upload and analyze resume for targeted questions</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger value="github" className="flex items-center gap-1 transition-all duration-200">
                      <Github className="h-4 w-4" />
                      GitHub
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Analyze GitHub profile for technical questions</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger value="linkedin" className="flex items-center gap-1 transition-all duration-200">
                      <Linkedin className="h-4 w-4" />
                      LinkedIn
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Generate questions from LinkedIn experience</TooltipContent>
                </Tooltip>
              </TabsList>
            ) : (
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="question" className="flex items-center gap-1">
                  <MessageCircle className="h-4 w-4" />
                  Current Question
                </TabsTrigger>
                <TabsTrigger value="live-questions" className="flex items-center gap-1">
                  <History className="h-4 w-4" />
                  Live Questions ({sentQuestions.length})
                </TabsTrigger>
              </TabsList>
            )}
          </div>
          
          <div className="flex-1 overflow-hidden">
            {isCandidate ? (
              // Candidates see tabbed interface with current question and live questions
              <>
                <TabsContent value="question" className="p-6 h-full overflow-y-auto m-0">
                  <div className="h-full flex flex-col gap-4">
                    <Card className="flex-1">
                      <CardContent className="pt-6 h-full flex flex-col">
                        {interviewData.question ? (
                          <div className="space-y-4 flex-1">
                            <div className="flex gap-2">
                              <Badge variant="secondary">{interviewData.questionType}</Badge>
                              <Badge variant="outline">{interviewData.difficulty}</Badge>
                            </div>
                            <div 
                              className="text-base text-gray-800 whitespace-pre-wrap bg-gray-50 p-6 rounded-lg border leading-relaxed flex-1"
                              dangerouslySetInnerHTML={{
                                __html: highlightTopic(interviewData.question, customTopic)
                              }}
                            />
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
                    
                    {/* Speech Transcription Component */}
                    <SpeechTranscription
                      roomId={roomId || ""}
                      questionId={interviewData.question ? `current-question` : undefined}
                      isActive={!!interviewData.question}
                      onTranscriptUpdate={(transcript) => {
                        console.log('Transcript updated:', transcript);
                      }}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="live-questions" className="p-6 h-full overflow-y-auto m-0">
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Live Questions
                        <Badge variant="secondary">{sentQuestions.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {sentQuestionsLoading ? (
                        <div className="text-center py-8 text-gray-500">
                          <div className="animate-spin h-8 w-8 border-2 border-violet-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                          <div className="text-sm">Loading questions...</div>
                        </div>
                      ) : sentQuestions.length > 0 ? (
                        sentQuestions.map((question, index) => (
                          <Card key={question.id} className="border border-violet-200 bg-violet-50">
                            <CardContent className="p-4">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex gap-2">
                                    <Badge variant="secondary">{question.questionType}</Badge>
                                    <Badge variant="outline">{question.difficulty}</Badge>
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {new Date(question.timestamp).toLocaleTimeString()}
                                  </div>
                                </div>
                                <div className="text-sm text-gray-700 whitespace-pre-wrap">
                                  {question.question}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      ) : (
                        <div className="text-center py-12 text-gray-500">
                          <History className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                          <div className="text-base font-medium mb-2">No Questions Sent Yet</div>
                          <div className="text-sm text-gray-400">Questions sent by the interviewer will appear here in real-time</div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </>
            ) : (
              // Interviewers see full tabbed interface
              renderTabContent()
            )}
          </div>
        </Tabs>
      </div>

      {/* Unified Sidebar (Only for interviewers) - Toggle between Timeline and Performance */}
      {isInterviewer && activeSidebar !== 'closed' && (
        <div className="w-80 bg-white rounded-xl shadow-md border border-gray-200">
          {activeSidebar === 'timeline' && (
            <QuestionTimeline
              roomId={roomId || ""}
              isCollapsed={false}
              onToggleCollapse={() => setActiveSidebar('closed')}
            />
          )}
          {activeSidebar === 'performance' && (
            <PerformanceSidebar
              roomId={roomId || ""}
              isCollapsed={false}
              onToggleCollapse={() => setActiveSidebar('closed')}
            />
          )}
        </div>
      )}
    </div>
  );
}