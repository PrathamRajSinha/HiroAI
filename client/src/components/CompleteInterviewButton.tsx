import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CheckCircle, Loader2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
// @ts-ignore
import html2pdf from 'html2pdf.js';

interface CompleteInterviewButtonProps {
  roomId: string;
  onInterviewCompleted: () => void;
}

interface CompletionData {
  interviewerNotes: string;
  decision: 'hire' | 'no-hire' | 'pending';
  overallRating: number;
}

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
      // First complete the interview
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

      // Generate the PDF report
      const reportResponse = await fetch(`/api/interviews/${roomId}/report`);
      if (!reportResponse.ok) {
        throw new Error('Failed to generate report');
      }
      
      const reportData = await reportResponse.json();
      
      return { completion: await response.json(), report: reportData };
    },
    onSuccess: async (data) => {
      // Auto-download the PDF report
      if (data.report && data.report.reportHtml) {
        await generateAndDownloadPDF(data.report.reportHtml, `interview-report-${roomId}.pdf`);
      }
      
      toast({
        title: "Interview Completed Successfully",
        description: "The interview has been completed and the report has been downloaded.",
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

  const generateAndDownloadPDF = async (htmlContent: string, filename: string) => {
    try {
      const element = document.createElement('div');
      element.innerHTML = htmlContent;
      element.style.padding = '20px';
      element.style.fontFamily = 'Arial, sans-serif';
      element.style.lineHeight = '1.6';
      
      const options = {
        margin: 1,
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      await html2pdf().set(options).from(element).save();
      
      toast({
        title: "PDF Downloaded",
        description: `Interview report saved as ${filename}`,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "PDF Generation Failed",
        description: "Could not generate PDF report. Please try again.",
        variant: "destructive"
      });
    }
  };

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
                  <Download className="h-4 w-4 mr-2" />
                  Complete & Download Report
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}