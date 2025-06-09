import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useInterviewRoom, QuestionHistory, JobContext } from "@/hooks/useFirestore";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  ArrowLeft, 
  User, 
  Briefcase, 
  Clock, 
  FileText, 
  Brain, 
  Plus, 
  Download,
  ChevronRight,
  Code,
  CheckCircle,
  AlertCircle,
  BarChart3
} from "lucide-react";

interface InterviewThreadData {
  roomId: string;
  candidateName: string;
  candidateId: string;
  roleTitle: string;
  status: 'In Progress' | 'Completed' | 'Scheduled';
  timestamp: number;
  jobContext?: JobContext;
  questions: QuestionHistory[];
  overallSummary?: string;
  currentCode?: string;
}

export default function InterviewThread() {
  const params = useParams();
  const roomId = params.roomId;
  const { toast } = useToast();
  
  // State management
  const [interviewData, setInterviewData] = useState<InterviewThreadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewRoundDialog, setShowNewRoundDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  
  // Firestore integration
  const { 
    data: firestoreData, 
    getQuestionHistory, 
    getJobContext, 
    updateQuestion,
    updateInterviewData 
  } = useInterviewRoom(roomId || "");

  // Load interview data
  useEffect(() => {
    const loadInterviewData = async () => {
      if (!roomId) return;
      
      setLoading(true);
      try {
        // Load question history and job context
        const [questions, jobContext] = await Promise.all([
          getQuestionHistory(),
          getJobContext()
        ]);
        
        // Check if we have Firestore data
        const baseData: InterviewThreadData = {
          roomId,
          candidateName: (firestoreData as any)?.candidateName || "Unnamed Candidate",
          candidateId: `candidate_${roomId}`,
          roleTitle: jobContext?.jobTitle || (firestoreData as any)?.roleTitle || "Software Engineer",
          status: (firestoreData as any)?.status || "In Progress",
          timestamp: (firestoreData as any)?.timestamp || Date.now(),
          jobContext: jobContext || undefined,
          questions: questions || [],
          overallSummary: (firestoreData as any)?.overallSummary || (firestoreData as any)?.summary,
          currentCode: (firestoreData as any)?.currentCode || (firestoreData as any)?.code
        };
        
        setInterviewData(baseData);
        setCandidateName(baseData.candidateName);
      } catch (error) {
        console.error("Error loading interview data:", error);
        toast({
          title: "Load Error",
          description: "Failed to load interview data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadInterviewData();
  }, [roomId, firestoreData, getQuestionHistory, getJobContext]);

  // Export report mutation
  const exportReportMutation = useMutation({
    mutationFn: async (data: { format: 'pdf' | 'email', candidateName: string, candidateEmail: string, companyName: string }) => {
      const response = await fetch(`/api/generate-report/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate report');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
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

  // New round mutation
  const newRoundMutation = useMutation({
    mutationFn: async (data: { question: string, questionType: string, difficulty: string }) => {
      await updateQuestion(data.question, data.questionType, data.difficulty);
      return data;
    },
    onSuccess: () => {
      toast({
        title: "New Round Added",
        description: "Question added successfully",
      });
      setShowNewRoundDialog(false);
      // Reload data
      window.location.reload();
    },
    onError: (error) => {
      toast({
        title: "Add Failed",
        description: "Failed to add new round. Please try again.",
        variant: "destructive",
      });
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

  const handleNewRound = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const question = formData.get("question") as string;
    const questionType = formData.get("questionType") as string;
    const difficulty = formData.get("difficulty") as string;

    if (!question.trim()) {
      toast({
        title: "Missing Question",
        description: "Please enter a question.",
        variant: "destructive",
      });
      return;
    }

    newRoundMutation.mutate({ question, questionType, difficulty });
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Completed': return 'default';
      case 'In Progress': return 'secondary';
      case 'Scheduled': return 'outline';
      default: return 'outline';
    }
  };

  const getPerformanceIndicator = (score: number) => {
    if (score >= 7) return '✅';
    if (score < 5) return '⚠️';
    return '📊';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading interview data...</div>
        </div>
      </div>
    );
  }

  if (!interviewData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <div className="text-gray-600">Interview not found</div>
          <Link href="/dashboard">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Interview Thread</h1>
              <p className="text-gray-600">Complete interview timeline and analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Dialog open={showNewRoundDialog} onOpenChange={setShowNewRoundDialog}>
              <DialogTrigger asChild>
                <Button className="bg-indigo-600 hover:bg-indigo-700">
                  <Plus className="h-4 w-4 mr-2" />
                  New Round
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Interview Round</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleNewRound} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="question">Question</Label>
                    <Textarea
                      id="question"
                      name="question"
                      placeholder="Enter the interview question..."
                      required
                      rows={4}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="questionType">Question Type</Label>
                      <Select name="questionType" defaultValue="Coding">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Coding">Coding</SelectItem>
                          <SelectItem value="Behavioral">Behavioral</SelectItem>
                          <SelectItem value="System Design">System Design</SelectItem>
                          <SelectItem value="Technical">Technical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="difficulty">Difficulty</Label>
                      <Select name="difficulty" defaultValue="Medium">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Easy">Easy</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setShowNewRoundDialog(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={newRoundMutation.isPending}>
                      {newRoundMutation.isPending ? "Adding..." : "Add Round"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            
            <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export Report
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Export Interview Report</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="candidateName">Candidate Name</Label>
                    <Input
                      id="candidateName"
                      value={candidateName}
                      onChange={(e) => setCandidateName(e.target.value)}
                      placeholder="Enter candidate name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Enter company name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="candidateEmail">Candidate Email (for email delivery)</Label>
                    <Input
                      id="candidateEmail"
                      type="email"
                      value={candidateEmail}
                      onChange={(e) => setCandidateEmail(e.target.value)}
                      placeholder="candidate@email.com"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleExportReport('pdf')}
                      disabled={isGeneratingReport}
                      className="flex-1"
                    >
                      {isGeneratingReport ? "Generating..." : "Generate PDF"}
                    </Button>
                    <Button 
                      onClick={() => handleExportReport('email')}
                      disabled={isGeneratingReport}
                      variant="outline"
                      className="flex-1"
                    >
                      {isGeneratingReport ? "Sending..." : "Send Email"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Interview Overview Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-gray-500" />
                  <div>
                    <CardTitle className="text-xl">{interviewData.candidateName}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">Candidate ID: {interviewData.candidateId}</p>
                  </div>
                </div>
                <Badge variant={getStatusBadgeVariant(interviewData.status)}>
                  {interviewData.status === 'In Progress' && <Clock className="h-3 w-3 mr-1" />}
                  {interviewData.status === 'Completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                  {interviewData.status}
                </Badge>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Interview Date</div>
                <div className="font-medium">{new Date(interviewData.timestamp).toLocaleDateString()}</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Role Information */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Briefcase className="h-4 w-4" />
                  Role Information
                </div>
                <div className="space-y-1">
                  <div className="text-sm">
                    <span className="font-medium">Position:</span> {interviewData.roleTitle}
                  </div>
                  {interviewData.jobContext && (
                    <>
                      <div className="text-sm">
                        <span className="font-medium">Level:</span> {interviewData.jobContext.seniorityLevel}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Type:</span> {interviewData.jobContext.roleType}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Tech Stack:</span> {interviewData.jobContext.techStack}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Interview Stats */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <BarChart3 className="h-4 w-4" />
                  Interview Stats
                </div>
                <div className="space-y-1">
                  <div className="text-sm">
                    <span className="font-medium">Total Rounds:</span> {interviewData.questions.length}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Questions Asked:</span> {interviewData.questions.length}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Avg Score:</span> {
                      interviewData.questions.length > 0 && interviewData.questions.some(q => q.aiFeedback) 
                        ? (interviewData.questions
                            .filter(q => q.aiFeedback)
                            .reduce((acc, q) => acc + (q.aiFeedback?.scores.overall || 0), 0) / 
                           interviewData.questions.filter(q => q.aiFeedback).length).toFixed(1)
                        : 'N/A'
                    }/10
                  </div>
                </div>
              </div>

              {/* Overall Summary */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Brain className="h-4 w-4" />
                  AI Assessment
                </div>
                {interviewData.overallSummary ? (
                  <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                    {interviewData.overallSummary.substring(0, 150)}
                    {interviewData.overallSummary.length > 150 && '...'}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 italic">No summary available yet</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Interview Rounds Timeline */}
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">Interview Timeline</h2>
            <Badge variant="outline">{interviewData.questions.length} Round{interviewData.questions.length !== 1 ? 's' : ''}</Badge>
          </div>

          {interviewData.questions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Questions Yet</h3>
                <p className="text-gray-600 mb-4">Start the interview by adding the first question.</p>
                <Button onClick={() => setShowNewRoundDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Question
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {interviewData.questions
                .sort((a, b) => b.timestamp - a.timestamp)
                .map((question, index) => (
                <Card key={question.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full text-sm font-semibold">
                          {interviewData.questions.length - index}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{question.questionType}</Badge>
                            <Badge variant="secondary">{question.difficulty}</Badge>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(question.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      {question.aiFeedback && (
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {getPerformanceIndicator(question.aiFeedback.scores.overall)}
                          </span>
                          <span className="text-sm font-semibold text-indigo-600">
                            {question.aiFeedback.scores.overall}/10
                          </span>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Question */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Question:</h4>
                        <div className="text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                          {question.question}
                        </div>
                      </div>

                      {/* Candidate Code/Answer */}
                      {question.candidateCode && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            <Code className="h-4 w-4" />
                            Candidate Solution:
                          </h4>
                          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm font-mono overflow-x-auto">
                            <pre>{question.candidateCode}</pre>
                          </div>
                        </div>
                      )}

                      {/* AI Feedback */}
                      {question.aiFeedback && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                            <Brain className="h-4 w-4" />
                            AI Performance Analysis
                          </h4>
                          
                          {/* Scores Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                            <div className="text-center">
                              <div className="text-xs text-gray-600">Correctness (30%)</div>
                              <div className="text-sm font-semibold flex items-center justify-center gap-1">
                                {question.aiFeedback.scores.correctness}/10
                                <span className="text-xs">
                                  {getPerformanceIndicator(question.aiFeedback.scores.correctness)}
                                </span>
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-xs text-gray-600">Relevance (30%)</div>
                              <div className="text-sm font-semibold flex items-center justify-center gap-1">
                                {question.aiFeedback.scores.relevance || question.aiFeedback.scores.correctness}/10
                                <span className="text-xs">
                                  {getPerformanceIndicator(question.aiFeedback.scores.relevance || question.aiFeedback.scores.correctness)}
                                </span>
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-xs text-gray-600">Efficiency (15%)</div>
                              <div className="text-sm font-semibold flex items-center justify-center gap-1">
                                {question.aiFeedback.scores.efficiency}/10
                                <span className="text-xs">
                                  {getPerformanceIndicator(question.aiFeedback.scores.efficiency)}
                                </span>
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-xs text-gray-600">Readability (15%)</div>
                              <div className="text-sm font-semibold flex items-center justify-center gap-1">
                                {question.aiFeedback.scores.readability}/10
                                <span className="text-xs">
                                  {getPerformanceIndicator(question.aiFeedback.scores.readability)}
                                </span>
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-xs text-gray-600">Quality (10%)</div>
                              <div className="text-sm font-semibold flex items-center justify-center gap-1">
                                {question.aiFeedback.scores.quality}/10
                                <span className="text-xs">
                                  {getPerformanceIndicator(question.aiFeedback.scores.quality)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Overall Score */}
                          <div className="text-center mb-4 p-3 bg-white rounded-lg border">
                            <div className="text-xs text-gray-600 mb-1">Weighted Overall Score</div>
                            <div className="text-lg font-bold text-indigo-600 flex items-center justify-center gap-2">
                              {question.aiFeedback.scores.overall}/10
                              <span className="text-lg">
                                {getPerformanceIndicator(question.aiFeedback.scores.overall)}
                              </span>
                            </div>
                          </div>

                          {/* AI Verdict */}
                          {question.aiFeedback.scoreNote && (
                            <div className={`text-xs px-3 py-2 rounded-lg font-medium text-center mb-3 ${
                              question.aiFeedback.scores.overall < 3 
                                ? 'bg-red-100 text-red-700' 
                                : question.aiFeedback.scores.overall < 5 
                                ? 'bg-yellow-100 text-yellow-700'
                                : question.aiFeedback.scores.overall < 7 
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              <span className="mr-1">
                                {getPerformanceIndicator(question.aiFeedback.scores.overall)}
                              </span>
                              {question.aiFeedback.scoreNote}
                            </div>
                          )}

                          {/* Feedback Summary */}
                          <div className="text-sm text-blue-700">
                            <strong>Summary:</strong> {question.aiFeedback.summary}
                          </div>

                          {/* Collapsible Detailed Analysis */}
                          {question.aiFeedback.fullExplanation && (
                            <Collapsible className="mt-3">
                              <CollapsibleTrigger className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 font-medium">
                                <Brain className="h-3 w-3" />
                                View Detailed Analysis
                                <ChevronRight className="h-3 w-3" />
                              </CollapsibleTrigger>
                              <CollapsibleContent className="mt-2">
                                <div className="text-xs text-blue-700 whitespace-pre-wrap bg-white p-3 rounded border">
                                  {question.aiFeedback.fullExplanation}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          )}

                          {/* Improvement Suggestions */}
                          {question.aiFeedback.suggestion && (
                            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                              <div className="text-xs font-semibold text-amber-800 mb-1">💡 Improvement Suggestions</div>
                              <div className="text-xs text-amber-700">{question.aiFeedback.suggestion}</div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* No feedback state */}
                      {!question.aiFeedback && question.candidateCode && (
                        <div className="text-center py-4 text-gray-500 border border-dashed border-gray-300 rounded-lg">
                          <Brain className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                          <div className="text-sm">AI analysis pending</div>
                          <div className="text-xs">Code submitted but not yet analyzed</div>
                        </div>
                      )}

                      {/* No code submitted */}
                      {!question.candidateCode && (
                        <div className="text-center py-4 text-gray-500 border border-dashed border-gray-300 rounded-lg">
                          <Code className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                          <div className="text-sm">No code submitted</div>
                          <div className="text-xs">Candidate has not provided a solution yet</div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Current Code Section */}
        {interviewData.currentCode && interviewData.currentCode.trim() && interviewData.currentCode !== 'No code submitted' && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Latest Code State
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm font-mono overflow-x-auto">
                <pre>{interviewData.currentCode}</pre>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}