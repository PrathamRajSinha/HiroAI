import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle, Brain, FileText, MessageCircle, Clock, User, ThumbsUp, ThumbsDown, Minus } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface InterviewCompletionProps {
  roomId: string;
  onInterviewCompleted: () => void;
}

interface CompletionData {
  status: 'completed';
  finalSummary: string;
  interviewerNotes: string;
  finalDecision: 'hire' | 'maybe' | 'no_hire';
  completedAt: number;
  completedBy: string;
}

export function InterviewCompletion({ roomId, onInterviewCompleted }: InterviewCompletionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'confirm' | 'generating' | 'review'>('confirm');
  const [aiSummary, setAiSummary] = useState<string>('');
  const [interviewerNotes, setInterviewerNotes] = useState<string>('');
  const [finalDecision, setFinalDecision] = useState<string>('');
  const { toast } = useToast();

  const completeInterviewMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/complete-interview', 'POST', { roomId });
      return response;
    },
    onSuccess: (data) => {
      setAiSummary(data.summary);
      setStep('review');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate interview summary",
        variant: "destructive",
      });
    }
  });

  const submitFeedbackMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/submit-interview-feedback', 'POST', {
        roomId,
        interviewerNotes,
        finalDecision,
        aiSummary
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Interview completed and feedback saved successfully",
      });
      setIsOpen(false);
      onInterviewCompleted();
    },
    onError: (error: any) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to save interview feedback",
        variant: "destructive",
      });
    }
  });

  const handleStartCompletion = () => {
    setStep('generating');
    completeInterviewMutation.mutate();
  };

  const handleSubmitFeedback = () => {
    if (!finalDecision.trim()) {
      toast({
        title: "Required Field",
        description: "Please select a final decision",
        variant: "destructive",
      });
      return;
    }
    submitFeedbackMutation.mutate();
  };

  const getDecisionIcon = (decision: string) => {
    switch (decision) {
      case 'hire':
        return <ThumbsUp className="h-4 w-4 text-green-600" />;
      case 'maybe':
        return <Minus className="h-4 w-4 text-yellow-600" />;
      case 'no_hire':
        return <ThumbsDown className="h-4 w-4 text-red-600" />;
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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="default"
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Complete Interview
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Complete Interview
          </DialogTitle>
        </DialogHeader>

        {step === 'confirm' && (
          <div className="space-y-6">
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-yellow-800">Ready to Complete Interview?</div>
                    <div className="text-sm text-yellow-700 mt-1">
                      This will generate a comprehensive AI summary combining code analysis, 
                      verbal responses, and profile insights. You'll then provide final feedback.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">What will be analyzed:</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50">
                  <Brain className="h-4 w-4 text-violet-600" />
                  <span className="text-sm">Code Quality & Performance</span>
                </div>
                <div className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50">
                  <MessageCircle className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">Verbal Response Transcripts</span>
                </div>
                <div className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50">
                  <FileText className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Resume & Background Analysis</span>
                </div>
                <div className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50">
                  <User className="h-4 w-4 text-gray-600" />
                  <span className="text-sm">GitHub Profile Insights</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleStartCompletion}
                className="bg-green-600 hover:bg-green-700"
              >
                <Brain className="h-4 w-4 mr-2" />
                Generate Summary
              </Button>
            </div>
          </div>
        )}

        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="w-12 h-12 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin"></div>
            <div className="text-center">
              <div className="font-medium text-gray-900">Generating AI Summary</div>
              <div className="text-sm text-gray-500 mt-1">
                Analyzing code quality, verbal responses, and candidate background...
              </div>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-violet-600" />
                  AI-Generated Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48 w-full rounded-md border p-4">
                  <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {aiSummary}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Interviewer Feedback</h3>
              
              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any additional observations, concerns, or highlights from the interview..."
                  value={interviewerNotes}
                  onChange={(e) => setInterviewerNotes(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="decision">Final Decision *</Label>
                <Select value={finalDecision} onValueChange={setFinalDecision}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your recommendation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hire">
                      <div className="flex items-center gap-2">
                        <ThumbsUp className="h-4 w-4 text-green-600" />
                        <span>Hire - Strong candidate</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="maybe">
                      <div className="flex items-center gap-2">
                        <Minus className="h-4 w-4 text-yellow-600" />
                        <span>Maybe - Borderline candidate</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="no_hire">
                      <div className="flex items-center gap-2">
                        <ThumbsDown className="h-4 w-4 text-red-600" />
                        <span>No Hire - Not suitable</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {finalDecision && (
                <Card className={cn("border", getDecisionColor(finalDecision))}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      {getDecisionIcon(finalDecision)}
                      <span className="font-medium">
                        {finalDecision === 'hire' && 'Recommend to Hire'}
                        {finalDecision === 'maybe' && 'Uncertain - Needs Discussion'}
                        {finalDecision === 'no_hire' && 'Do Not Recommend'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setStep('confirm')}
                disabled={submitFeedbackMutation.isPending}
              >
                Back
              </Button>
              <Button 
                onClick={handleSubmitFeedback}
                disabled={submitFeedbackMutation.isPending || !finalDecision}
                className="bg-green-600 hover:bg-green-700"
              >
                {submitFeedbackMutation.isPending ? "Saving..." : "Complete Interview"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}