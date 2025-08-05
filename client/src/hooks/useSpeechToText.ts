import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface SpeechToTextHook {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  startListening: () => void;
  stopListening: () => void;
  isSupported: boolean;
  error: string | null;
}

interface UseTranscriptProps {
  roomId: string;
  questionId?: string;
  isActive: boolean;
  onTranscriptUpdate?: (transcript: string) => void;
}

export const useSpeechToText = ({ roomId, questionId, isActive, onTranscriptUpdate }: UseTranscriptProps): SpeechToTextHook => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  // Save transcript to Firestore
  const saveTranscript = useCallback(async (finalTranscript: string) => {
    if (!roomId || !questionId || !finalTranscript.trim()) return;

    try {
      const transcriptRef = doc(db, 'interviews', roomId, 'answers', questionId);
      await setDoc(transcriptRef, {
        transcript: finalTranscript,
        timestamp: serverTimestamp(),
        questionId,
        isComplete: false
      }, { merge: true });
      
      onTranscriptUpdate?.(finalTranscript);
    } catch (err) {
      console.error('Error saving transcript:', err);
      setError('Failed to save transcript');
    }
  }, [roomId, questionId, onTranscriptUpdate]);

  useEffect(() => {
    if (!isSupported) {
      setError('Speech recognition is not supported in this browser');
      return;
    }

    // Only initialize recognition if not already initialized
    if (recognitionRef.current) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;
    
    // Add service hints to improve reliability
    if ('serviceURI' in recognition) {
      // Some browsers support setting service URI
      recognition.serviceURI = 'wss://www.google.com/speech-api/v2/recognize';
    }

    recognition.onstart = () => {
      console.log('Speech recognition started');
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let currentFinalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptSegment = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          currentFinalTranscript += transcriptSegment + ' ';
        } else {
          interimTranscript += transcriptSegment;
        }
      }

      // Update state with the current final transcript
      if (currentFinalTranscript) {
        setTranscript(prev => prev + currentFinalTranscript);
        // Save the updated transcript
        saveTranscript(transcript + currentFinalTranscript);
      }
      
      setInterimTranscript(interimTranscript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      
      // Handle specific error cases with focus on microphone conflicts
      if (event.error === 'aborted') {
        setError('Speech recognition was stopped');
      } else if (event.error === 'not-allowed') {
        setError('Microphone is in use by another application. Please stop the video call or use the text input mode.');
      } else if (event.error === 'no-speech') {
        setError('No speech detected. Try speaking louder or closer to the microphone.');
      } else if (event.error === 'network') {
        setError('Network connection issue. Speech recognition requires internet connectivity.');
      } else if (event.error === 'service-not-allowed') {
        setError('Speech recognition service not available. Please try again later.');
      } else if (event.error === 'audio-capture') {
        setError('Microphone is in use by another application. Please stop the video call or use the text input mode.');
      } else {
        // Default to microphone conflict for unknown errors since that's the most common issue
        setError('Microphone is in use by another application. Please stop the video call or use the text input mode.');
      }
      
      setIsListening(false);
      
      // Do NOT auto-retry for permission/microphone errors to avoid conflicts
      if (event.error === 'network' && recognitionRef.current) {
        setTimeout(() => {
          if (!isListening && recognitionRef.current) {
            console.log('Retrying speech recognition after network error...');
            try {
              recognitionRef.current.start();
            } catch (retryErr) {
              console.error('Retry failed:', retryErr);
            }
          }
        }, 2000);
      }
    };

    recognition.onend = () => {
      console.log('Speech recognition ended');
      setIsListening(false);
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;

    // Cleanup on unmount only
    return () => {
      if (recognitionRef.current && isListening) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, [isSupported]); // Remove transcript and saveTranscript dependencies to prevent re-initialization

  const startListening = useCallback(async () => {
    if (!recognitionRef.current || isListening) return;
    
    console.log('Attempting to start speech recognition...');
    setError(null);
    setTranscript('');
    setInterimTranscript('');
    
    try {
      // Check if microphone is already in use by checking active media devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputDevices = devices.filter(device => device.kind === 'audioinput');
      
      if (audioInputDevices.length === 0) {
        setError('No microphone detected. Please connect a microphone and try again.');
        return;
      }

      // Request microphone permissions first and check for conflicts
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('Microphone permission granted, checking for conflicts...');
        
        // Check if the stream has active tracks (indicating potential conflicts)
        const audioTracks = stream.getAudioTracks();
        
        if (audioTracks.length === 0) {
          setError('No audio input available. Please check your microphone connection.');
          return;
        }

        // Stop the test stream immediately to release the microphone
        audioTracks.forEach(track => track.stop());
        
        // Small delay to ensure microphone is released
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Now start speech recognition
        recognitionRef.current.start();
        
      } catch (micError: any) {
        console.error('Microphone access error:', micError);
        
        // Handle specific microphone error cases
        if (micError.name === 'NotAllowedError') {
          setError('Microphone access denied. Please allow microphone access in your browser settings and try again.');
        } else if (micError.name === 'NotFoundError') {
          setError('No microphone found. Please connect a microphone and refresh the page.');
        } else if (micError.name === 'AbortError' || micError.name === 'NotReadableError') {
          setError('Microphone is in use by another application. Please stop the video call or use the text input mode.');
        } else if (micError.name === 'OverconstrainedError') {
          setError('Microphone configuration issue. Please try a different microphone or refresh the page.');
        } else {
          // Generic fallback for other microphone conflicts
          setError('Microphone is in use by another application. Please stop the video call or use the text input mode.');
        }
        return;
      }
      
    } catch (err: any) {
      console.error('Error starting speech recognition:', err);
      
      if (err.name === 'NotSupportedError') {
        setError('Speech recognition is not supported in this browser. Please use Chrome or Safari.');
      } else {
        setError('Failed to start speech recognition. Please ensure you are using a supported browser.');
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    
    console.log('Stopping speech recognition...');
    
    try {
      if (isListening) {
        recognitionRef.current.stop();
      }
    } catch (err) {
      console.error('Error stopping speech recognition:', err);
    }
    
    // Mark transcript as complete in Firestore
    if (roomId && questionId && transcript.trim()) {
      const transcriptRef = doc(db, 'interviews', roomId, 'answers', questionId);
      setDoc(transcriptRef, {
        transcript,
        timestamp: serverTimestamp(),
        questionId,
        isComplete: true
      }, { merge: true }).catch(err => {
        console.error('Error marking transcript complete:', err);
      });
    }
  }, [isListening, roomId, questionId, transcript]);

  // Auto-start listening when a new questionId is received and isActive is true
  useEffect(() => {
    if (questionId && isActive && !isListening && recognitionRef.current) {
      console.log('Auto-starting transcription for new question:', questionId);
      startListening();
    }
  }, [questionId, isActive, isListening, startListening]);

  return {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    isSupported,
    error
  };
};

// Hook for listening to transcripts (for interviewers)
export const useTranscriptListener = (roomId: string, questionId?: string) => {
  const [transcript, setTranscript] = useState<string>('');
  const [isComplete, setIsComplete] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!roomId || !questionId) {
      setTranscript('');
      setIsComplete(false);
      return;
    }

    setLoading(true);
    
    const transcriptRef = doc(db, 'interviews', roomId, 'answers', questionId);
    
    // Real-time listener for transcript updates
    const unsubscribe = onSnapshot(transcriptRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setTranscript(data.transcript || '');
        setIsComplete(data.isComplete || false);
      } else {
        setTranscript('');
        setIsComplete(false);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error listening to transcript:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [roomId, questionId]);

  return { transcript, isComplete, loading };
};

// Extend Window interface for TypeScript
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}