import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle, Brain, FileText, ThumbsUp, ThumbsDown, Minus, Clock, User, Award, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface CompletedInterviewViewProps {
  roomId: string;
}

interface InterviewSummary {
  finalSummary: string;
  interviewerNotes: string;
  finalDecision: 'hire' | 'maybe' | 'no_hire';
  completedAt: number;
  completedBy: string;
}

export function CompletedInterviewView({ roomId }: CompletedInterviewViewProps) {
  const [summary, setSummary] = useState<InterviewSummary | null>(null);
  const [interviewData, setInterviewData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!roomId) return;

    // Listen to the completed interview summary
    const summaryRef = doc(db, 'interviews', roomId, 'finalSummary', 'complete');
    const unsubscribeSummary = onSnapshot(summaryRef, (doc) => {
      if (doc.exists()) {
        setSummary(doc.data() as InterviewSummary);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error listening to summary:', error);
      setLoading(false);
    });

    // Listen to the main interview data
    const interviewRef = doc(db, 'interviews', roomId);
    const unsubscribeInterview = onSnapshot(interviewRef, (doc) => {
      if (doc.exists()) {
        setInterviewData(doc.data());
      }
    });

    return () => {
      unsubscribeSummary();
      unsubscribeInterview();
    };
  }, [roomId]);

  const getDecisionIcon = (decision: string) => {
    switch (decision) {
      case 'hire':
        return <ThumbsUp className="h-5 w-5 text-green-600" />;
      case 'maybe':
        return <Minus className="h-5 w-5 text-yellow-600" />;
      case 'no_hire':
        return <ThumbsDown className="h-5 w-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getDecisionColor = (decision: string) => {
    switch (decision) {
      case 'hire':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'maybe':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'no_hire':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getDecisionText = (decision: string) => {
    switch (decision) {
      case 'hire':
        return 'Recommend to Hire';
      case 'maybe':
        return 'Uncertain - Needs Discussion';
      case 'no_hire':
        return 'Do Not Recommend';
      default:
        return 'No Decision';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!summary) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="p-6 text-center">
          <Clock className="h-12 w-12 mx-auto mb-4 text-yellow-600" />
          <div className="text-lg font-medium text-yellow-800 mb-2">Interview Not Completed</div>
          <div className="text-sm text-yellow-700">
            This interview has not been marked as completed yet. Use the "Complete Interview" button to generate a final summary.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Status */}
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <div className="text-lg font-semibold text-green-800">Interview Completed</div>
                <div className="text-sm text-green-700">
                  Completed on {new Date(summary.completedAt).toLocaleString()}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-green-700 mb-2">Final Decision</div>
              <Badge className={cn("text-sm px-3 py-1", getDecisionColor(summary.finalDecision))}>
                <span className="flex items-center gap-2">
                  {getDecisionIcon(summary.finalDecision)}
                  {getDecisionText(summary.finalDecision)}
                </span>
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI-Generated Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-violet-600" />
            AI-Generated Interview Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96 w-full rounded-md border p-4">
            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {summary.finalSummary}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Interviewer Notes */}
      {summary.interviewerNotes && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              Interviewer Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-700 whitespace-pre-wrap bg-blue-50 p-4 rounded-lg border">
              {summary.interviewerNotes}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Interview Statistics */}
      {interviewData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-orange-600" />
              Interview Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {interviewData.jobContext?.jobTitle || 'N/A'}
                </div>
                <div className="text-xs text-gray-600 mt-1">Position</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {interviewData.jobContext?.seniorityLevel || 'N/A'}
                </div>
                <div className="text-xs text-gray-600 mt-1">Level</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {interviewData.questionType || 'General'}
                </div>
                <div className="text-xs text-gray-600 mt-1">Question Type</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {interviewData.difficulty || 'Medium'}
                </div>
                <div className="text-xs text-gray-600 mt-1">Difficulty</div>
              </div>
            </div>
            
            {interviewData.jobContext?.techStack && (
              <div className="mt-4">
                <div className="text-sm font-medium text-gray-700 mb-2">Tech Stack</div>
                <div className="flex flex-wrap gap-2">
                  {interviewData.jobContext.techStack.split(',').map((tech: string, index: number) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tech.trim()}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button 
          variant="outline"
          onClick={() => {
            import('./CompleteInterviewButton').then(({ downloadInterviewReport }) => {
              downloadInterviewReport(roomId, toast);
            });
          }}
          className="flex-1"
        >
          <Download className="h-4 w-4 mr-2" />
          Download Report
        </Button>
        <Button 
          variant="outline"
          onClick={() => window.print()}
          className="flex-1"
        >
          <FileText className="h-4 w-4 mr-2" />
          Print Summary
        </Button>
        <Button 
          variant="outline"
          onClick={() => window.location.reload()}
          className="flex-1"
        >
          Return to Interview
        </Button>
      </div>
    </div>
  );
}