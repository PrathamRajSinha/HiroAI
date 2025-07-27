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

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = transcript;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptSegment = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          finalTranscript += transcriptSegment + ' ';
        } else {
          interimTranscript += transcriptSegment;
        }
      }

      setTranscript(finalTranscript);
      setInterimTranscript(interimTranscript);

      // Save final transcript to Firestore
      if (finalTranscript !== transcript) {
        saveTranscript(finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setError(`Speech recognition error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [isSupported, transcript, saveTranscript]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return;
    
    setError(null);
    setTranscript('');
    setInterimTranscript('');
    
    try {
      recognitionRef.current.start();
    } catch (err) {
      console.error('Error starting speech recognition:', err);
      setError('Failed to start speech recognition');
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) return;
    
    recognitionRef.current.stop();
    
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