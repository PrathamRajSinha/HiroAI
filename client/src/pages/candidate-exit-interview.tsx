import React, { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Star, ThumbsUp, ThumbsDown, Clock, Send } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';

interface ExitInterviewData {
  overallExperience: number;
  interviewDifficulty: 'too-easy' | 'just-right' | 'too-hard';
  platformUsability: number;
  technicalIssues: boolean;
  technicalIssuesDescription: string;
  interviewerRating: number;
  questionsRelevant: boolean;
  questionsQuality: number;
  improvementSuggestions: string;
  wouldRecommend: boolean;
  additionalComments: string;
}

export function CandidateExitInterview() {
  const [match, params] = useRoute('/candidate/:roomId/exit-interview');
  const [formData, setFormData] = useState<ExitInterviewData>({
    overallExperience: 4,
    interviewDifficulty: 'just-right',
    platformUsability: 4,
    technicalIssues: false,
    technicalIssuesDescription: '',
    interviewerRating: 4,
    questionsRelevant: true,
    questionsQuality: 4,
    improvementSuggestions: '',
    wouldRecommend: true,
    additionalComments: ''
  });
  const { toast } = useToast();
  const roomId = params?.roomId;

  const submitFeedbackMutation = useMutation({
    mutationFn: async (data: ExitInterviewData) => {
      const response = await fetch(`/api/interviews/${roomId}/candidate-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      return await response.json();
    },
    onSuccess: () => {
      // Redirect to thank you page
      window.location.href = `/candidate/${roomId}/thank-you`;
    },
    onError: (error) => {
      console.error('Error submitting feedback:', error);
      toast({
        title: "Submission Failed",
        description: "Failed to submit your feedback. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitFeedbackMutation.mutate(formData);
  };

  const updateFormData = (key: keyof ExitInterviewData, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  if (!roomId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <div className="text-red-600 mb-2">Invalid Interview Link</div>
            <div className="text-sm text-gray-600">The interview link appears to be invalid.</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="p-3 bg-violet-100 rounded-full">
              <MessageSquare className="h-8 w-8 text-violet-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Exit Interview</h1>
              <div className="text-gray-600">Help us improve your interview experience</div>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            Your feedback is completely anonymous and will help us improve our platform
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Overall Experience */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                Overall Experience
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-3 block">
                  How would you rate your overall interview experience? ({formData.overallExperience}/5)
                </Label>
                <Slider
                  value={[formData.overallExperience]}
                  onValueChange={(value) => updateFormData('overallExperience', value[0])}
                  max={5}
                  min={1}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Poor</span>
                  <span>Excellent</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Interview Difficulty */}
          <Card>
            <CardHeader>
              <CardTitle>Interview Difficulty</CardTitle>
            </CardHeader>
            <CardContent>
              <Label className="text-sm font-medium mb-3 block">
                How would you rate the difficulty level of the interview questions?
              </Label>
              <RadioGroup
                value={formData.interviewDifficulty}
                onValueChange={(value: 'too-easy' | 'just-right' | 'too-hard') => 
                  updateFormData('interviewDifficulty', value)
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="too-easy" id="too-easy" />
                  <Label htmlFor="too-easy">Too Easy</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="just-right" id="just-right" />
                  <Label htmlFor="just-right">Just Right</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="too-hard" id="too-hard" />
                  <Label htmlFor="too-hard">Too Hard</Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Platform Usability */}
          <Card>
            <CardHeader>
              <CardTitle>Platform Experience</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-3 block">
                  How easy was it to use the interview platform? ({formData.platformUsability}/5)
                </Label>
                <Slider
                  value={[formData.platformUsability]}
                  onValueChange={(value) => updateFormData('platformUsability', value[0])}
                  max={5}
                  min={1}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Very Difficult</span>
                  <span>Very Easy</span>
                </div>
              </div>

              {/* Technical Issues */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Did you experience any technical issues?</Label>
                <RadioGroup
                  value={formData.technicalIssues ? 'yes' : 'no'}
                  onValueChange={(value) => updateFormData('technicalIssues', value === 'yes')}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="no-issues" />
                    <Label htmlFor="no-issues">No, everything worked smoothly</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="yes-issues" />
                    <Label htmlFor="yes-issues">Yes, I encountered some problems</Label>
                  </div>
                </RadioGroup>

                {formData.technicalIssues && (
                  <div className="ml-6">
                    <Label htmlFor="issues-description" className="text-sm">
                      Please describe the technical issues you encountered:
                    </Label>
                    <Textarea
                      id="issues-description"
                      placeholder="Describe the technical problems you faced..."
                      value={formData.technicalIssuesDescription}
                      onChange={(e) => updateFormData('technicalIssuesDescription', e.target.value)}
                      className="mt-2"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Interviewer Rating */}
          <Card>
            <CardHeader>
              <CardTitle>Interviewer Experience</CardTitle>
            </CardHeader>
            <CardContent>
              <Label className="text-sm font-medium mb-3 block">
                How would you rate your interviewer? ({formData.interviewerRating}/5)
              </Label>
              <Slider
                value={[formData.interviewerRating]}
                onValueChange={(value) => updateFormData('interviewerRating', value[0])}
                max={5}
                min={1}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Poor</span>
                <span>Excellent</span>
              </div>
            </CardContent>
          </Card>

          {/* Questions Quality */}
          <Card>
            <CardHeader>
              <CardTitle>Interview Questions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-3 block">Were the questions relevant to the role?</Label>
                <RadioGroup
                  value={formData.questionsRelevant ? 'yes' : 'no'}
                  onValueChange={(value) => updateFormData('questionsRelevant', value === 'yes')}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="relevant-yes" />
                    <Label htmlFor="relevant-yes">Yes, very relevant</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="relevant-no" />
                    <Label htmlFor="relevant-no">No, not very relevant</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm font-medium mb-3 block">
                  Rate the quality of interview questions ({formData.questionsQuality}/5)
                </Label>
                <Slider
                  value={[formData.questionsQuality]}
                  onValueChange={(value) => updateFormData('questionsQuality', value[0])}
                  max={5}
                  min={1}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Poor Quality</span>
                  <span>Excellent Quality</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recommendations and Improvements */}
          <Card>
            <CardHeader>
              <CardTitle>Recommendations & Feedback</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-3 block">
                  Would you recommend this interview platform to other candidates?
                </Label>
                <RadioGroup
                  value={formData.wouldRecommend ? 'yes' : 'no'}
                  onValueChange={(value) => updateFormData('wouldRecommend', value === 'yes')}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="recommend-yes" />
                    <Label htmlFor="recommend-yes" className="flex items-center gap-2">
                      <ThumbsUp className="h-4 w-4 text-green-600" />
                      Yes, I would recommend it
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="recommend-no" />
                    <Label htmlFor="recommend-no" className="flex items-center gap-2">
                      <ThumbsDown className="h-4 w-4 text-red-600" />
                      No, I would not recommend it
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="improvements" className="text-sm font-medium">
                  What suggestions do you have for improving the interview experience?
                </Label>
                <Textarea
                  id="improvements"
                  placeholder="Share your ideas for making the interview process better..."
                  value={formData.improvementSuggestions}
                  onChange={(e) => updateFormData('improvementSuggestions', e.target.value)}
                  className="mt-2 min-h-[80px]"
                />
              </div>

              <div>
                <Label htmlFor="additional-comments" className="text-sm font-medium">
                  Any additional comments or feedback?
                </Label>
                <Textarea
                  id="additional-comments"
                  placeholder="Share any other thoughts about your interview experience..."
                  value={formData.additionalComments}
                  onChange={(e) => updateFormData('additionalComments', e.target.value)}
                  className="mt-2 min-h-[80px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="text-center">
            <Button 
              type="submit" 
              size="lg" 
              className="bg-violet-600 hover:bg-violet-700 text-white px-8"
              disabled={submitFeedbackMutation.isPending}
            >
              {submitFeedbackMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Submitting...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Submit Feedback
                </div>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CandidateExitInterview;