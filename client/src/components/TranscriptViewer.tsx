import { useEffect } from 'react';
import { useTranscriptListener } from '@/hooks/useSpeechToText';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Volume2, Clock, Download } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface TranscriptViewerProps {
  roomId: string;
  questionId?: string;
  currentQuestion?: string;
}

export function TranscriptViewer({ roomId, questionId, currentQuestion }: TranscriptViewerProps) {
  const { transcript, isComplete, loading } = useTranscriptListener(roomId, questionId);
  const { toast } = useToast();

  // Mutation for live transcript analysis using Gemini
  const liveAnalysisMutation = useMutation({
    mutationFn: async ({ transcript, question }: { transcript: string; question?: string }) => {
      const response = await fetch('/api/live-transcript-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript, question }),
      });
      if (!response.ok) {
        throw new Error('Failed to analyze transcript');
      }
      return response.json();
    },
    onError: (error) => {
      console.error('Error analyzing transcript:', error);
      // Fail silently for live analysis to avoid interrupting the user
    },
  });

  // Trigger live analysis whenever transcript changes
  useEffect(() => {
    if (transcript && transcript.trim().length > 50) { // Only analyze substantial content
      const timeoutId = setTimeout(() => {
        liveAnalysisMutation.mutate({ 
          transcript, 
          question: currentQuestion 
        });
      }, 2000); // Debounce for 2 seconds to avoid too frequent API calls

      return () => clearTimeout(timeoutId);
    }
  }, [transcript, currentQuestion]);

  const handleDownload = () => {
    if (!transcript) return;
    
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${roomId}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Download Complete",
      description: "Transcript has been downloaded successfully.",
    });
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Live Transcript
          </CardTitle>
          <div className="flex items-center gap-2">
            {loading && (
              <Badge variant="secondary" className="animate-pulse">
                <Clock className="h-3 w-3 mr-1" />
                Loading...
              </Badge>
            )}
            {transcript && (
              <Badge variant={isComplete ? "default" : "destructive"}>
                {isComplete ? (
                  <>
                    <MicOff className="h-3 w-3 mr-1" />
                    Complete
                  </>
                ) : (
                  <>
                    <Mic className="h-3 w-3 mr-1" />
                    Recording
                  </>
                )}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {currentQuestion && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-xs font-medium text-blue-900 mb-1">Current Question:</div>
            <div className="text-sm text-blue-800">{currentQuestion.slice(0, 150)}...</div>
          </div>
        )}

        {/* Transcript Display */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-700">Candidate's Response:</div>
            {transcript && (
              <div className="text-xs text-gray-500">
                {transcript.split(' ').filter(word => word.length > 0).length} words
              </div>
            )}
          </div>
          
          <div className="bg-white border rounded-lg p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
            {transcript ? (
              <div className="text-sm leading-relaxed text-gray-900 whitespace-pre-wrap">
                {transcript}
                {!isComplete && (
                  <span className="animate-pulse ml-1 text-blue-500">|</span>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Mic className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <div className="text-sm">No transcript available</div>
                <div className="text-xs mt-1">
                  {questionId ? "Candidate hasn't started speaking yet" : "No active question"}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {transcript && (
          <div className="flex gap-2 pt-3 border-t">
            <Button
              onClick={handleDownload}
              variant="outline"
              size="sm"
            >
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
          </div>
        )}

        {/* Live AI Analysis Display */}
        {liveAnalysisMutation.data && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
            <div className="text-xs font-medium text-blue-900 mb-2 flex items-center gap-1">
              Live AI Analysis
              {liveAnalysisMutation.isPending && (
                <span className="animate-pulse text-blue-600">●</span>
              )}
            </div>
            <div className="text-sm text-blue-800">{liveAnalysisMutation.data.summary}</div>
          </div>
        )}

        {/* Loading indicator for live analysis */}
        {liveAnalysisMutation.isPending && !liveAnalysisMutation.data && transcript && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-4">
            <div className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-2">
              <span className="animate-pulse">●</span>
              Analyzing response...
            </div>
          </div>
        )}

        {/* Status Information */}
        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
          <strong>Status:</strong> {
            !questionId ? "No active question" :
            !transcript ? "Waiting for candidate to speak" :
            isComplete ? "Transcript completed" :
            "Recording in progress"
          }
        </div>
      </CardContent>
    </Card>
  );
}