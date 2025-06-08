import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Calendar, User, Briefcase, Github, Linkedin, FileText, Star, MessageSquare, Plus } from "lucide-react";

interface InterviewReview {
  id: string;
  candidateName: string;
  candidateId: string;
  roleTitle: string;
  roundNumber: number;
  interviewerName: string;
  timestamp: number;
  status: string;
  jobContext: {
    jobTitle: string;
    seniorityLevel: string;
    techStack: string;
    roleType: string;
  };
  questions: Array<{
    id: string;
    question: string;
    questionType: string;
    difficulty: string;
    candidateCode?: string;
    aiFeedback?: {
      scores: {
        correctness: number;
        efficiency: number;
        quality: number;
        readability: number;
        overall: number;
      };
      summary: string;
      fullExplanation: string;
      suggestion?: string;
    };
    timestamp: number;
  }>;
  candidateProfile?: {
    resume?: string;
    githubProfile?: any;
    linkedinProfile?: any;
  };
  rounds: Array<{
    roundNumber: number;
    date: string;
    status: string;
    questionsCount: number;
    averageScore?: number;
    verdict?: string;
  }>;
  overallSummary?: string;
  manualNotes?: string;
}

export default function InterviewReview() {
  const params = useParams();
  const { toast } = useToast();
  const interviewId = params.id;
  const [activeTab, setActiveTab] = useState("overview");
  const [manualNotes, setManualNotes] = useState("");

  // Fetch interview review data
  const { data: review, isLoading, refetch } = useQuery({
    queryKey: [`/api/interviews/${interviewId}/review`],
    queryFn: async () => {
      const response = await apiRequest(`/api/interviews/${interviewId}/review`, 'GET');
      return response;
    },
    enabled: !!interviewId
  });

  // Save manual notes
  const saveNotesMutation = useMutation({
    mutationFn: async (notes: string) => {
      return apiRequest(`/api/interviews/${interviewId}/notes`, 'PUT', { notes });
    },
    onSuccess: () => {
      toast({
        title: "Notes Saved",
        description: "Manual notes have been saved successfully.",
      });
      refetch();
    },
    onError: () => {
      toast({
        title: "Save Failed",
        description: "Failed to save notes. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Create next round
  const createNextRoundMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/interviews/next-round', 'POST', { 
        interviewId, 
        candidateId: review?.candidateId 
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Next Round Created",
        description: "New interview round has been scheduled.",
      });
      // Redirect to new interview room
      window.location.href = `/interview/${data.roomId}?role=interviewer`;
    },
    onError: () => {
      toast({
        title: "Failed to Create Round",
        description: "Could not create next round. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Generate next round suggestions
  const generateSuggestionsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/interviews/${interviewId}/suggestions`, 'POST');
    },
    onSuccess: (data) => {
      toast({
        title: "Suggestions Generated",
        description: "AI suggestions for next round have been created.",
      });
    }
  });

  useEffect(() => {
    if (review?.manualNotes) {
      setManualNotes(review.manualNotes);
    }
  }, [review]);

  const handleSaveNotes = () => {
    saveNotesMutation.mutate(manualNotes);
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600";
    if (score >= 6) return "text-yellow-600";
    return "text-red-600";
  };

  const getVerdictColor = (verdict: string) => {
    switch (verdict?.toLowerCase()) {
      case 'recommended': return "bg-green-100 text-green-800";
      case 'not recommended': return "bg-red-100 text-red-800";
      case 'conditional': return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading interview review...</p>
        </div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Interview not found</p>
          <Link href="/dashboard">
            <Button className="mt-4" variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {review.candidateName} - Interview Review
                </h1>
                <p className="text-gray-600">
                  {review.roleTitle} • Round {review.roundNumber} • {formatDate(review.timestamp)}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                onClick={() => generateSuggestionsMutation.mutate()}
                disabled={generateSuggestionsMutation.isPending}
                variant="outline"
              >
                💡 Generate Suggestions
              </Button>
              <Button
                onClick={() => createNextRoundMutation.mutate()}
                disabled={createNextRoundMutation.isPending}
                className="bg-violet-600 hover:bg-violet-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Next Round
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Candidate Info & Job Context */}
          <div className="space-y-6">
            {/* Candidate Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Candidate Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-medium">{review.candidateName}</p>
                  <p className="text-sm text-gray-600">Candidate ID: {review.candidateId}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Interviewer</p>
                  <p className="text-sm">{review.interviewerName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Status</p>
                  <Badge className={getVerdictColor(review.status)}>{review.status}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Job Context */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Job Context
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">Position</p>
                  <p className="text-sm">{review.jobContext.jobTitle}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Seniority Level</p>
                  <Badge variant="outline">{review.jobContext.seniorityLevel}</Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Tech Stack</p>
                  <p className="text-sm">{review.jobContext.techStack}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Interview Type</p>
                  <Badge variant="outline">{review.jobContext.roleType}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Round History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Round History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {review.rounds.map((round: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">Round {round.roundNumber}</p>
                        <p className="text-sm text-gray-600">{round.date}</p>
                        <p className="text-xs text-gray-500">{round.questionsCount} questions</p>
                      </div>
                      <div className="text-right">
                        <Badge className={getVerdictColor(round.status)} variant="outline">
                          {round.status}
                        </Badge>
                        {round.averageScore && (
                          <p className={`text-sm font-medium ${getScoreColor(round.averageScore)}`}>
                            {round.averageScore}/10
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Main Content */}
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="questions">Questions</TabsTrigger>
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                {/* Overall Summary */}
                {review.overallSummary && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Overall Performance Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700 leading-relaxed">{review.overallSummary}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Performance Metrics */}
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {review.questions.length > 0 && review.questions[0].aiFeedback && (
                        <>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-violet-600">
                              {review.questions[0].aiFeedback.scores.correctness}/10
                            </p>
                            <p className="text-sm text-gray-600">Correctness</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-blue-600">
                              {review.questions[0].aiFeedback.scores.efficiency}/10
                            </p>
                            <p className="text-sm text-gray-600">Efficiency</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-green-600">
                              {review.questions[0].aiFeedback.scores.quality}/10
                            </p>
                            <p className="text-sm text-gray-600">Quality</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-yellow-600">
                              {review.questions[0].aiFeedback.scores.readability}/10
                            </p>
                            <p className="text-sm text-gray-600">Readability</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-gray-900">
                              {review.questions[0].aiFeedback.scores.overall}/10
                            </p>
                            <p className="text-sm text-gray-600">Overall</p>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Questions Tab */}
              <TabsContent value="questions" className="space-y-6">
                {review.questions.map((question: any, index: number) => (
                  <Card key={question.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">Question {index + 1}</CardTitle>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="outline">{question.questionType}</Badge>
                            <Badge variant="outline">{question.difficulty}</Badge>
                          </div>
                        </div>
                        <p className="text-sm text-gray-500">
                          {formatDate(question.timestamp)}
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="font-medium text-gray-900 mb-2">Question:</p>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-gray-700">{question.question}</p>
                        </div>
                      </div>

                      {question.candidateCode && (
                        <div>
                          <p className="font-medium text-gray-900 mb-2">Candidate's Solution:</p>
                          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                            <pre className="text-sm">{question.candidateCode}</pre>
                          </div>
                        </div>
                      )}

                      {question.aiFeedback && (
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <p className="font-medium text-blue-900 mb-3">AI Feedback</p>
                          
                          <div className="grid grid-cols-5 gap-3 mb-4">
                            <div className="text-center">
                              <p className="text-lg font-bold text-violet-600">
                                {question.aiFeedback.scores.correctness}
                              </p>
                              <p className="text-xs text-gray-600">Correctness</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-blue-600">
                                {question.aiFeedback.scores.efficiency}
                              </p>
                              <p className="text-xs text-gray-600">Efficiency</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-green-600">
                                {question.aiFeedback.scores.quality}
                              </p>
                              <p className="text-xs text-gray-600">Quality</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-yellow-600">
                                {question.aiFeedback.scores.readability}
                              </p>
                              <p className="text-xs text-gray-600">Readability</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-gray-900">
                                {question.aiFeedback.scores.overall}
                              </p>
                              <p className="text-xs text-gray-600">Overall</p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <p className="font-medium text-blue-900">Summary:</p>
                              <p className="text-blue-800 text-sm">{question.aiFeedback.summary}</p>
                            </div>
                            
                            {question.aiFeedback.fullExplanation && (
                              <div>
                                <p className="font-medium text-blue-900">Detailed Analysis:</p>
                                <p className="text-blue-800 text-sm">{question.aiFeedback.fullExplanation}</p>
                              </div>
                            )}
                            
                            {question.aiFeedback.suggestion && (
                              <div>
                                <p className="font-medium text-blue-900">Suggestions:</p>
                                <p className="text-blue-800 text-sm">{question.aiFeedback.suggestion}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* Profile Tab */}
              <TabsContent value="profile" className="space-y-6">
                <Tabs defaultValue="resume" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="resume" className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Resume
                    </TabsTrigger>
                    <TabsTrigger value="github" className="flex items-center gap-2">
                      <Github className="h-4 w-4" />
                      GitHub
                    </TabsTrigger>
                    <TabsTrigger value="linkedin" className="flex items-center gap-2">
                      <Linkedin className="h-4 w-4" />
                      LinkedIn
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="resume">
                    <Card>
                      <CardHeader>
                        <CardTitle>Resume Analysis</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {review.candidateProfile?.resume ? (
                          <ScrollArea className="h-96">
                            <div className="text-sm text-gray-700 whitespace-pre-wrap">
                              {review.candidateProfile.resume}
                            </div>
                          </ScrollArea>
                        ) : (
                          <p className="text-gray-500">No resume data available</p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="github">
                    <Card>
                      <CardHeader>
                        <CardTitle>GitHub Profile</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {review.candidateProfile?.githubProfile ? (
                          <div className="space-y-4">
                            <div>
                              <p className="font-medium">Profile URL:</p>
                              <a 
                                href={review.candidateProfile.githubProfile.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {review.candidateProfile.githubProfile.url}
                              </a>
                            </div>
                            <div>
                              <p className="font-medium">Repositories:</p>
                              <p className="text-sm text-gray-600">
                                {review.candidateProfile.githubProfile.public_repos || 'N/A'} public repositories
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-500">No GitHub data available</p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="linkedin">
                    <Card>
                      <CardHeader>
                        <CardTitle>LinkedIn Profile</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {review.candidateProfile?.linkedinProfile ? (
                          <div className="space-y-4">
                            <div>
                              <p className="font-medium">Profile URL:</p>
                              <a 
                                href={review.candidateProfile.linkedinProfile.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {review.candidateProfile.linkedinProfile.url}
                              </a>
                            </div>
                            <div>
                              <p className="font-medium">Headline:</p>
                              <p className="text-sm text-gray-600">
                                {review.candidateProfile.linkedinProfile.headline || 'N/A'}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-500">No LinkedIn data available</p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </TabsContent>

              {/* Notes Tab */}
              <TabsContent value="notes" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Manual Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder="Add your observations, feedback, and recommendations..."
                      value={manualNotes}
                      onChange={(e) => setManualNotes(e.target.value)}
                      className="min-h-48"
                    />
                    <div className="flex justify-end">
                      <Button 
                        onClick={handleSaveNotes}
                        disabled={saveNotesMutation.isPending}
                      >
                        {saveNotesMutation.isPending ? "Saving..." : "Save Notes"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}