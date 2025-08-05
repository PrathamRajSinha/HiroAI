import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Mic, MicOff, Volume2, VolumeX, Edit3, Save } from 'lucide-react';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { toast } from '@/hooks/use-toast';

interface SpeechTranscriptionProps {
  roomId: string;
  questionId?: string;
  isActive: boolean; // Whether this question is currently active
  role?: 'interviewer' | 'candidate';
  onTranscriptUpdate?: (transcript: string) => void;
}

export function SpeechTranscription({ 
  roomId, 
  questionId, 
  isActive, 
  role = 'candidate',
  onTranscriptUpdate 
}: SpeechTranscriptionProps) {
  const [isEnabled, setIsEnabled] = useState(role === 'candidate' ? true : false);
  const [useManualInput, setUseManualInput] = useState(false);
  const [manualText, setManualText] = useState('');
  
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
    isActive,
    onTranscriptUpdate 
  });

  // Auto-start/stop listening for candidates when questions change
  useEffect(() => {
    if (role === 'candidate' && isActive && questionId && isEnabled && !isListening && isSupported) {
      // Automatically start listening for candidates when a new question is active
      startListening();
    } else if (!isActive && isListening) {
      // Stop listening when question becomes inactive
      stopListening();
    }
  }, [isActive, questionId, isEnabled, isListening, isSupported, role, startListening, stopListening]);

  // Show error toast only for interviewers, handle silently for candidates
  useEffect(() => {
    if (error && role === 'interviewer') {
      toast({
        title: "Speech Recognition Error",
        description: error,
        variant: "destructive",
      });
    } else if (error && role === 'candidate') {
      // For candidates, just silently stop transcription
      console.log('Speech recognition error (handled silently):', error);
      if (isListening) {
        stopListening();
      }
    }
  }, [error, role, isListening, stopListening]);

  const handleToggleListening = () => {
    if (!isSupported) {
      if (role === 'interviewer') {
        toast({
          title: "Not Supported",
          description: "Speech recognition is not supported in this browser. Please use Chrome or Safari.",
          variant: "destructive",
        });
      }
      return;
    }

    if (!questionId) {
      if (role === 'interviewer') {
        toast({
          title: "No Active Question",
          description: "Please wait for a question to be sent before starting transcription.",
          variant: "destructive",
        });
      }
      return;
    }

    // Handle specific microphone conflict errors
    if (error && error.includes('Microphone is in use by another application')) {
      if (role === 'interviewer') {
        toast({
          title: "Microphone Conflict",
          description: "The microphone is being used by the video call. Please stop the video call or use text input mode.",
          variant: "destructive",
        });
      }
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleRetry = () => {
    // Don't retry if there's a microphone conflict error
    if (error && error.includes('Microphone is in use')) {
      toast({
        title: "Cannot Retry",
        description: "Microphone is still in use by another application. Please stop the video call first.",
        variant: "destructive",
      });
      return;
    }
    
    if (!isListening) {
      startListening();
    }
  };

  const handleSaveManualText = () => {
    if (manualText.trim() && onTranscriptUpdate) {
      onTranscriptUpdate(manualText);
      toast({
        title: "Response Saved",
        description: "Your written response has been saved to the interview.",
      });
    }
  };

  const handleToggleInputMode = () => {
    setUseManualInput(!useManualInput);
    if (isListening) {
      stopListening();
    }
  };

  const handleToggleEnable = () => {
    if (isEnabled && isListening) {
      stopListening();
    }
    setIsEnabled(!isEnabled);
  };

  // For candidates, don't show anything if not supported - fail silently
  if (!isSupported && role === 'candidate') {
    return null;
  }

  // For interviewers, show the not supported message
  if (!isSupported && role === 'interviewer') {
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

  // Minimal interface for candidates
  if (role === 'candidate') {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 mb-4">
        <div className="flex items-center gap-2">
          {isListening ? (
            <>
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              <span className="text-xs text-gray-600">Recording your response...</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
              <span className="text-xs text-gray-600">
                {isEnabled ? 'Ready to record' : 'Voice recording disabled'}
              </span>
            </>
          )}
        </div>
      </div>
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
            {/* Full controls for interviewers */}
            {role === 'interviewer' && (
              <>
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
                      variant="outline"
                      size="sm"
                      onClick={handleToggleInputMode}
                      className={useManualInput ? "bg-blue-50 border-blue-200" : ""}
                    >
                      <Edit3 className="h-4 w-4 mr-2" />
                      {useManualInput ? "Voice Mode" : "Text Mode"}
                    </Button>
                    
                    {!useManualInput && (
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
                        
                        {error && error.includes('Microphone is in use') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleToggleInputMode}
                            className="text-green-600 border-green-200 hover:bg-green-50"
                          >
                            Switch to Text Mode
                          </Button>
                        )}
                      </>
                    )}
                  </>
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
          {useManualInput ? (
            /* Manual text input mode */
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-700">Write Your Response:</div>
              <Textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="Type your response to the interview question here..."
                className="min-h-[120px] resize-none"
                disabled={!isActive || !questionId}
              />
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  Words: {manualText.split(' ').filter(word => word.length > 0).length}
                </div>
                <Button
                  onClick={handleSaveManualText}
                  disabled={!manualText.trim() || !isActive || !questionId}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Response
                </Button>
              </div>
            </div>
          ) : (
            /* Speech recognition mode */
            <>
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
              {isEnabled && !transcript && !interimTranscript && !useManualInput && (
                <div className="text-center py-6 text-gray-500">
                  <Mic className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <div className="text-sm">Click "Start" to begin speech transcription</div>
                  <div className="text-xs mt-1">Your speech will be automatically saved</div>
                </div>
              )}
            </>
          )}
          
          {/* Error display */}
          {error && (
            <div className={`text-xs p-3 rounded-lg border ${
              error.includes('network') ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
              error.includes('Microphone is in use') ? 'bg-blue-50 border-blue-200 text-blue-800' :
              error.includes('not-allowed') || error.includes('denied') ? 'bg-red-50 border-red-200 text-red-800' :
              'bg-orange-50 border-orange-200 text-orange-800'
            }`}>
              <div className="font-medium mb-1">Speech Recognition Issue:</div>
              <div>{error}</div>
              {error.includes('network') && (
                <div className="mt-2 text-xs">
                  💡 Try checking your internet connection or clicking the Retry button above.
                </div>
              )}
              {error.includes('Microphone is in use') && (
                <div className="mt-2 text-xs">
                  💡 This is common when using video calls. Switch to "Text Mode" to continue with written responses.
                </div>
              )}
              {(error.includes('not-allowed') || error.includes('denied')) && !error.includes('Microphone is in use') && (
                <div className="mt-2 text-xs">
                  💡 Click the microphone icon in your browser's address bar to allow microphone access.
                </div>
              )}
            </div>
          )}

          {/* Instructions and notes */}
          {isEnabled && !error && (
            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
              {useManualInput ? (
                <>
                  <strong>Text Mode:</strong> Type your response and click "Save Response" to record your answer.
                </>
              ) : (
                <>
                  <strong>Voice Mode:</strong> Requires microphone permissions and internet connectivity. 
                  Your browser may prompt you to allow microphone access. Switch to "Text Mode" if speech recognition fails.
                </>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}