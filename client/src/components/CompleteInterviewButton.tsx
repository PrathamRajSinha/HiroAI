import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CheckCircle, Loader2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';

interface CompleteInterviewButtonProps {
  roomId: string;
  onInterviewCompleted: () => void;
}

interface CompletionData {
  interviewerNotes: string;
  decision: 'hire' | 'no-hire' | 'pending';
  overallRating: number;
}

// Export the download function for use in other components
export const downloadInterviewReport = async (roomId: string, toast: any) => {
  try {
    const response = await fetch(`/api/interviews/${roomId}/download-report`);
    
    if (!response.ok) {
      throw new Error('Failed to generate report');
    }
    
    // Create blob from the response
    const blob = await response.blob();
    
    // Create download link
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `interview-report-${roomId}.pdf`;
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    toast({
      title: "PDF Downloaded",
      description: "Interview report has been downloaded successfully.",
    });
  } catch (error) {
    console.error('Error downloading report:', error);
    toast({
      title: "Download Failed",
      description: "Could not download the report. Please try again.",
      variant: "destructive"
    });
  }
};

export function CompleteInterviewButton({ roomId, onInterviewCompleted }: CompleteInterviewButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<CompletionData>({
    interviewerNotes: '',
    decision: 'pending',
    overallRating: 3
  });
  const { toast } = useToast();

  const completeInterviewMutation = useMutation({
    mutationFn: async (data: CompletionData) => {
      const response = await fetch(`/api/interviews/${roomId}/complete`, {
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
        throw new Error('Failed to complete interview');
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Interview Completed Successfully",
        description: "The interview has been marked as complete. You can now download the report.",
      });
      
      setIsOpen(false);
      onInterviewCompleted();
    },
    onError: (error) => {
      console.error('Error completing interview:', error);
      toast({
        title: "Error Completing Interview",
        description: "Failed to complete the interview. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleDownloadReport = () => downloadInterviewReport(roomId, toast);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    completeInterviewMutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          className="w-full bg-green-600 hover:bg-green-700 text-white"
          size="sm"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Complete Interview
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Interview</DialogTitle>
          <DialogDescription>
            Provide final notes and hiring decision to complete the interview.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Interviewer Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Final Notes</Label>
            <Textarea
              id="notes"
              placeholder="Enter your final notes about the candidate's performance..."
              value={formData.interviewerNotes}
              onChange={(e) => setFormData(prev => ({ ...prev, interviewerNotes: e.target.value }))}
              className="min-h-[100px]"
            />
          </div>

          {/* Decision */}
          <div className="space-y-3">
            <Label>Hiring Decision</Label>
            <RadioGroup
              value={formData.decision}
              onValueChange={(value: 'hire' | 'no-hire' | 'pending') => 
                setFormData(prev => ({ ...prev, decision: value }))
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="hire" id="hire" />
                <Label htmlFor="hire" className="text-green-700">Recommend Hire</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no-hire" id="no-hire" />
                <Label htmlFor="no-hire" className="text-red-700">Do Not Recommend</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pending" id="pending" />
                <Label htmlFor="pending" className="text-yellow-700">Needs Further Review</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Overall Rating */}
          <div className="space-y-2">
            <Label htmlFor="rating">Overall Rating (1-5)</Label>
            <select
              id="rating"
              value={formData.overallRating}
              onChange={(e) => setFormData(prev => ({ ...prev, overallRating: parseInt(e.target.value) }))}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value={1}>1 - Poor</option>
              <option value={2}>2 - Below Average</option>
              <option value={3}>3 - Average</option>
              <option value={4}>4 - Good</option>
              <option value={5}>5 - Excellent</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              disabled={completeInterviewMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={completeInterviewMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {completeInterviewMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Complete Interview
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}