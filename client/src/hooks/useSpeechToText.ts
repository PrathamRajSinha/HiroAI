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
  onTranscriptUpdate?: (transcript: string) => void;
}

export const useSpeechToText = ({ roomId, questionId, onTranscriptUpdate }: UseTranscriptProps): SpeechToTextHook => {
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
      
      // Handle specific error cases
      if (event.error === 'aborted') {
        setError('Speech recognition was stopped');
      } else if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone access and try again.');
      } else if (event.error === 'no-speech') {
        setError('No speech was detected. Please try speaking again.');
      } else {
        setError(`Speech recognition error: ${event.error}`);
      }
      
      setIsListening(false);
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

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return;
    
    console.log('Attempting to start speech recognition...');
    setError(null);
    setTranscript('');
    setInterimTranscript('');
    
    try {
      // Request microphone permissions first
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => {
          console.log('Microphone permission granted');
          recognitionRef.current.start();
        })
        .catch((err) => {
          console.error('Microphone permission denied:', err);
          setError('Microphone access is required for speech recognition. Please allow microphone access and try again.');
        });
    } catch (err) {
      console.error('Error starting speech recognition:', err);
      setError('Failed to start speech recognition. Please ensure you are using a supported browser.');
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