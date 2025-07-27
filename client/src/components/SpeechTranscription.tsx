import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { toast } from '@/hooks/use-toast';

interface SpeechTranscriptionProps {
  roomId: string;
  questionId?: string;
  isActive: boolean; // Whether this question is currently active
  onTranscriptUpdate?: (transcript: string) => void;
}

export function SpeechTranscription({ 
  roomId, 
  questionId, 
  isActive, 
  onTranscriptUpdate 
}: SpeechTranscriptionProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  
  const {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    isSupported,
    error
  } = useSpeechToText({ 
    roomId, 
    questionId, 
    onTranscriptUpdate 
  });

  // Auto-stop listening when question changes or becomes inactive
  useEffect(() => {
    if (!isActive && isListening) {
      stopListening();
    }
  }, [isActive, isListening, stopListening]);

  // Show error toast
  useEffect(() => {
    if (error) {
      toast({
        title: "Speech Recognition Error",
        description: error,
        variant: "destructive",
      });
    }
  }, [error]);

  const handleToggleListening = () => {
    if (!isSupported) {
      toast({
        title: "Not Supported",
        description: "Speech recognition is not supported in this browser. Please use Chrome or Safari.",
        variant: "destructive",
      });
      return;
    }

    if (!questionId) {
      toast({
        title: "No Active Question",
        description: "Please wait for a question to be sent before starting transcription.",
        variant: "destructive",
      });
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleRetry = () => {
    if (!isListening) {
      startListening();
    }
  };

  const handleToggleEnable = () => {
    if (isEnabled && isListening) {
      stopListening();
    }
    setIsEnabled(!isEnabled);
  };

  if (!isSupported) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-yellow-800">
            <VolumeX className="h-4 w-4" />
            <span className="text-sm">Speech recognition not supported in this browser</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`transition-colors ${isListening ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Speech Transcription
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleEnable}
              className={isEnabled ? "bg-green-50 border-green-200" : ""}
            >
              {isEnabled ? "Enabled" : "Enable"}
            </Button>
            {isEnabled && (
              <>
                <Button
                  variant={isListening ? "destructive" : "default"}
                  size="sm"
                  onClick={handleToggleListening}
                  disabled={!isActive || !questionId}
                  className={isListening ? "animate-pulse" : ""}
                >
                  {isListening ? (
                    <>
                      <MicOff className="h-4 w-4 mr-2" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4 mr-2" />
                      Start
                    </>
                  )}
                </Button>
                
                {error && error.includes('network') && !isListening && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                  >
                    Retry
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
        
        {isEnabled && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Badge variant={isListening ? "destructive" : "secondary"}>
              {isListening ? "Recording" : "Ready"}
            </Badge>
            {!isActive && (
              <span className="text-yellow-600">Waiting for active question...</span>
            )}
          </div>
        )}
      </CardHeader>
      
      {isEnabled && (
        <CardContent className="space-y-3">
          {/* Live transcript display */}
          {(transcript || interimTranscript) && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">Your Response:</div>
              <div className="bg-white border rounded-lg p-3 min-h-[100px] max-h-[200px] overflow-y-auto">
                <div className="text-sm leading-relaxed">
                  {/* Final transcript */}
                  <span className="text-gray-900">{transcript}</span>
                  {/* Interim transcript (lighter color) */}
                  {interimTranscript && (
                    <span className="text-gray-500 italic">{interimTranscript}</span>
                  )}
                  {/* Cursor when listening */}
                  {isListening && <span className="animate-pulse ml-1 text-blue-500">|</span>}
                </div>
              </div>
              
              {transcript && (
                <div className="text-xs text-gray-500 flex justify-between">
                  <span>Words: {transcript.split(' ').filter(word => word.length > 0).length}</span>
                  <span>Auto-saved to interview</span>
                </div>
              )}
            </div>
          )}
          
          {/* Instructions */}
          {isEnabled && !transcript && !interimTranscript && (
            <div className="text-center py-6 text-gray-500">
              <Mic className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <div className="text-sm">Click "Start" to begin speech transcription</div>
              <div className="text-xs mt-1">Your speech will be automatically saved</div>
            </div>
          )}
          
          {/* Error display */}
          {error && (
            <div className={`text-xs p-3 rounded-lg border ${
              error.includes('network') ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
              error.includes('not-allowed') ? 'bg-red-50 border-red-200 text-red-800' :
              'bg-orange-50 border-orange-200 text-orange-800'
            }`}>
              <div className="font-medium mb-1">Speech Recognition Issue:</div>
              <div>{error}</div>
              {error.includes('network') && (
                <div className="mt-2 text-xs">
                  💡 Try checking your internet connection or clicking the Retry button above.
                </div>
              )}
            </div>
          )}

          {/* Permissions note */}
          {isEnabled && !error && (
            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
              <strong>Note:</strong> This feature requires microphone permissions and internet connectivity. 
              Your browser may prompt you to allow microphone access.
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}