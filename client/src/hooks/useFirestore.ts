import { useState, useEffect } from "react";
import { doc, onSnapshot, setDoc, getDoc, collection, addDoc, query, orderBy, getDocs, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Custom hook for real-time sent questions listening
export function useSentQuestions(roomId: string) {
  const [sentQuestions, setSentQuestions] = useState<SentQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      return;
    }

    const sentQuestionsRef = collection(db, "interviews", roomId, "sentQuestions");
    const q = query(sentQuestionsRef, orderBy("timestamp", "desc"));
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const questions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as SentQuestion));
        setSentQuestions(questions);
        setLoading(false);
      },
      (err) => {
        console.error("Error listening to sent questions:", err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [roomId]);

  return { sentQuestions, loading };
}

export interface InterviewData {
  question?: string;
  summary?: string;
  questionType?: string;
  difficulty?: string;
  code?: string;
  lastUpdatedBy?: 'interviewer' | 'candidate';
  timestamp?: number;
}

export interface JobContext {
  jobTitle: string;
  techStack: string;
  seniorityLevel: 'Junior' | 'Mid' | 'Senior';
  roleType: 'Coding' | 'Behavioral' | 'System Design';
  timestamp?: number;
}

export interface CodeFeedback {
  summary: string;
  scores: {
    correctness: number;
    relevance: number;
    efficiency: number;
    quality: number;
    readability: number;
    overall: number;
  };
  fullExplanation: string;
  suggestion?: string;
  scoreNote?: string;
}

export interface QuestionHistory {
  id: string;
  question: string;
  questionType: string;
  difficulty: string;
  timestamp: number;
  candidateCode?: string;
  aiFeedback?: CodeFeedback;
}

export interface SentQuestion {
  id: string;
  question: string;
  questionType: string;
  difficulty: string;
  timestamp: number;
  sentBy: string;
  isAsked: boolean;
}

export function useInterviewRoom(roomId: string) {
  const [data, setData] = useState<InterviewData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debug: Log Firebase connection status
  console.log('[useInterviewRoom] Hook initialized with roomId:', roomId);
  console.log('[useInterviewRoom] Firebase db object:', db ? 'Connected' : 'Not connected');

  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      return;
    }

    const docRef = doc(db, "interviews", roomId);
    console.log('[useInterviewRoom] Document path for subscription:', docRef.path);
    
    const unsubscribe = onSnapshot(
      docRef,
      (doc) => {
        console.log('[useInterviewRoom] Document snapshot received, exists:', doc.exists());
        if (doc.exists()) {
          const data = doc.data() as InterviewData;
          console.log('[useInterviewRoom] Document data received:', Object.keys(data));
          setData(data);
        } else {
          console.log('[useInterviewRoom] Document does not exist, setting empty data');
          setData({});
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("[useInterviewRoom] Firestore subscription error:", err);
        console.error("[useInterviewRoom] Error code:", err.code);
        console.error("[useInterviewRoom] Error message:", err.message);
        setError("Failed to sync with Firebase");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [roomId]);

  const updateQuestion = async (question: string, questionType: string, difficulty: string) => {
    if (!roomId) {
      console.log('[updateQuestion] No roomId provided, returning early');
      return;
    }

    console.log('[updateQuestion] Starting question update with:', { roomId, questionType, difficulty });

    try {
      const timestamp = Date.now();
      console.log('[updateQuestion] Generated timestamp:', timestamp);
      
      // Update current question
      console.log('[updateQuestion] Attempting to update current question in interviews collection...');
      const docRef = doc(db, "interviews", roomId);
      console.log('[updateQuestion] Document reference created:', docRef.path);
      
      await setDoc(docRef, {
        question,
        questionType,
        difficulty,
        timestamp,
      }, { merge: true });
      console.log('[updateQuestion] Successfully updated current question document');

      // Add to history
      console.log('[updateQuestion] Attempting to add to history collection...');
      const historyRef = collection(db, "interviews", roomId, "history");
      console.log('[updateQuestion] History collection reference created:', historyRef.path);
      
      await addDoc(historyRef, {
        question,
        questionType,
        difficulty,
        timestamp,
      });
      console.log('[updateQuestion] Successfully added question to history');
      
    } catch (err: any) {
      console.error("[updateQuestion] Error updating question:", err);
      console.error("[updateQuestion] Error code:", err.code);
      console.error("[updateQuestion] Error message:", err.message);
      console.error("[updateQuestion] Full error object:", err);
      
      let errorMessage = "Failed to save question";
      if (err.code === 'permission-denied') {
        console.error("[updateQuestion] Permission denied - check Firestore security rules");
        errorMessage = "Permission denied - Firestore security rules need to be configured";
      } else if (err.code === 'failed-precondition') {
        console.error("[updateQuestion] Failed precondition - check Firebase project settings");
        errorMessage = "Firestore connection failed - check Firebase project settings";
      }
      
      setError(errorMessage);
      throw err;
    }
  };

  const updateSummary = async (summary: string) => {
    if (!roomId) return;

    try {
      const timestamp = Date.now();
      
      // Update local state immediately
      setData(prev => ({ ...prev, summary, timestamp }));
      
      // Try to update Firestore
      const docRef = doc(db, "interviews", roomId);
      await setDoc(docRef, {
        summary,
        timestamp,
      }, { merge: true });
      
      setError(null);
    } catch (err) {
      console.error("Error updating summary:", err);
      console.warn("Firestore failed, but summary is stored locally");
      setError(null); // Don't show error since we have local fallback
    }
  };

  const updateCode = async (code: string, userRole: 'interviewer' | 'candidate') => {
    if (!roomId) {
      console.log('[updateCode] No roomId provided, returning early');
      return;
    }

    console.log('[updateCode] Starting code update with:', { roomId, userRole, codeLength: code.length });

    try {
      console.log('[updateCode] Attempting to update code in interviews collection...');
      const docRef = doc(db, "interviews", roomId);
      console.log('[updateCode] Document reference created:', docRef.path);
      
      await setDoc(docRef, {
        code,
        lastUpdatedBy: userRole,
        timestamp: Date.now(),
      }, { merge: true });
      console.log('[updateCode] Successfully updated code document');
    } catch (err: any) {
      console.error("[updateCode] Error updating code:", err);
      console.error("[updateCode] Error code:", err.code);
      console.error("[updateCode] Error message:", err.message);
      setError("Failed to save code");
    }
  };

  const getQuestionHistory = async (): Promise<QuestionHistory[]> => {
    if (!roomId) return [];

    try {
      const historyRef = collection(db, "interviews", roomId, "history");
      const q = query(historyRef, orderBy("timestamp", "desc"));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as QuestionHistory));
    } catch (err) {
      console.error("Error fetching question history:", err);
      return [];
    }
  };

  const updateQuestionWithCode = async (questionId: string, candidateCode: string, aiFeedback?: CodeFeedback) => {
    if (!roomId) {
      console.log('[updateQuestionWithCode] No roomId provided, returning early');
      return;
    }

    console.log('[updateQuestionWithCode] Starting question code update with:', { 
      roomId, 
      questionId, 
      hasCode: !!candidateCode, 
      hasFeedback: !!aiFeedback 
    });

    try {
      console.log('[updateQuestionWithCode] Attempting to update question in history collection...');
      const questionRef = doc(db, "interviews", roomId, "history", questionId);
      console.log('[updateQuestionWithCode] Question reference created:', questionRef.path);
      
      const updateData: Partial<QuestionHistory> = { candidateCode };
      
      if (aiFeedback) {
        updateData.aiFeedback = aiFeedback;
        console.log('[updateQuestionWithCode] AI feedback included in update data');
      }
      
      await updateDoc(questionRef, updateData);
      console.log('[updateQuestionWithCode] Successfully updated question document with code');

      // Update timeline status when code is submitted and analyzed
      console.log('[updateQuestionWithCode] Attempting to update timeline status...');
      try {
        const questionsRef = collection(db, "interviews", roomId, "questions");
        console.log('[updateQuestionWithCode] Questions collection reference created:', questionsRef.path);
        
        const q = query(questionsRef, orderBy("timestamp", "desc"));
        console.log('[updateQuestionWithCode] Executing query to find recent sent questions...');
        
        const querySnapshot = await getDocs(q);
        console.log('[updateQuestionWithCode] Query executed, found', querySnapshot.docs.length, 'questions');
        
        // Find the most recent 'sent' question and update status
        const recentSentQuestion = querySnapshot.docs.find(doc => {
          const data = doc.data();
          console.log('[updateQuestionWithCode] Checking question status:', data.status);
          return data.status === 'sent';
        });
        
        if (recentSentQuestion) {
          console.log('[updateQuestionWithCode] Found recent sent question, updating status...');
          const newStatus = aiFeedback ? 'evaluated' : 'answered';
          console.log('[updateQuestionWithCode] New status will be:', newStatus);
          
          await updateDoc(recentSentQuestion.ref, {
            status: newStatus,
            code: candidateCode,
            analysis: aiFeedback,
            [newStatus + 'Timestamp']: Date.now()
          });
          console.log('[updateQuestionWithCode] Successfully updated timeline status');
        } else {
          console.log('[updateQuestionWithCode] No recent sent question found to update');
        }
      } catch (timelineError: any) {
        console.error("[updateQuestionWithCode] Error updating timeline with code:", timelineError);
        console.error("[updateQuestionWithCode] Timeline error code:", timelineError.code);
        console.error("[updateQuestionWithCode] Timeline error message:", timelineError.message);
      }
    } catch (err: any) {
      console.error("[updateQuestionWithCode] Error updating question with code:", err);
      console.error("[updateQuestionWithCode] Error code:", err.code);
      console.error("[updateQuestionWithCode] Error message:", err.message);
      console.error("[updateQuestionWithCode] Full error object:", err);
      throw err;
    }
  };

  const saveJobContext = async (jobContext: JobContext) => {
    if (!roomId) {
      console.log('[saveJobContext] No roomId provided, returning early');
      return;
    }

    console.log('[saveJobContext] Starting job context save with:', { roomId, jobContext });

    try {
      console.log('[saveJobContext] Attempting to save job context to interviews collection...');
      const docRef = doc(db, "interviews", roomId);
      console.log('[saveJobContext] Document reference created:', docRef.path);
      
      await setDoc(docRef, {
        jobContext: {
          ...jobContext,
          timestamp: Date.now(),
        },
      }, { merge: true });
      console.log('[saveJobContext] Successfully saved job context');
    } catch (err: any) {
      console.error("[saveJobContext] Error saving job context:", err);
      console.error("[saveJobContext] Error code:", err.code);
      console.error("[saveJobContext] Error message:", err.message);
      setError("Failed to save job context");
    }
  };

  const getJobContext = async (): Promise<JobContext | null> => {
    if (!roomId) return null;

    try {
      const docRef = doc(db, "interviews", roomId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists() && docSnap.data().jobContext) {
        return docSnap.data().jobContext as JobContext;
      }
      return null;
    } catch (err) {
      console.error("Error fetching job context:", err);
      return null;
    }
  };

  const updateInterviewData = async (interviewData: any) => {
    if (!roomId) return;

    try {
      const docRef = doc(db, "interviews", roomId);
      await setDoc(docRef, {
        ...interviewData,
        timestamp: Date.now(),
        lastUpdated: Date.now(),
      }, { merge: true });
    } catch (err) {
      console.error("Error updating interview data:", err);
      throw new Error("Failed to save interview data");
    }
  };

  const sendQuestionToCandidate = async (question: string, questionType: string, difficulty: string) => {
    if (!roomId) {
      console.log('[sendQuestionToCandidate] No roomId provided, returning early');
      return;
    }

    console.log('[sendQuestionToCandidate] Starting to send question to candidate:', { 
      roomId, 
      questionType, 
      difficulty 
    });

    try {
      console.log('[sendQuestionToCandidate] Attempting to add to sentQuestions collection...');
      const sentQuestionsRef = collection(db, "interviews", roomId, "sentQuestions");
      console.log('[sendQuestionToCandidate] SentQuestions collection reference created:', sentQuestionsRef.path);
      
      const sentQuestion: Omit<SentQuestion, 'id'> = {
        question,
        questionType,
        difficulty,
        timestamp: Date.now(),
        sentBy: "interviewer",
        isAsked: true
      };
      
      await addDoc(sentQuestionsRef, sentQuestion);
      console.log('[sendQuestionToCandidate] Successfully added question to sentQuestions collection');

      // Add question to timeline when sent to candidate
      console.log('[sendQuestionToCandidate] Attempting to add question to timeline...');
      try {
        const questionsRef = collection(db, "interviews", roomId, "questions");
        console.log('[sendQuestionToCandidate] Questions timeline collection reference created:', questionsRef.path);
        
        await addDoc(questionsRef, {
          question,
          questionType,
          difficulty,
          status: 'sent',
          timestamp: Date.now(),
          sentTimestamp: Date.now(),
          createdAt: new Date().toISOString()
        });
        console.log('[sendQuestionToCandidate] Successfully added question to timeline');
      } catch (timelineError: any) {
        console.error("[sendQuestionToCandidate] Error adding question to timeline:", timelineError);
        console.error("[sendQuestionToCandidate] Timeline error code:", timelineError.code);
        console.error("[sendQuestionToCandidate] Timeline error message:", timelineError.message);
      }
    } catch (err: any) {
      console.error("[sendQuestionToCandidate] Error sending question to candidate:", err);
      console.error("[sendQuestionToCandidate] Error code:", err.code);
      console.error("[sendQuestionToCandidate] Error message:", err.message);
      console.error("[sendQuestionToCandidate] Full error object:", err);
      throw err;
    }
  };

  const getSentQuestions = async (): Promise<SentQuestion[]> => {
    if (!roomId) return [];

    try {
      const sentQuestionsRef = collection(db, "interviews", roomId, "sentQuestions");
      const q = query(sentQuestionsRef, orderBy("timestamp", "desc"));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SentQuestion));
    } catch (err) {
      console.error("Error fetching sent questions:", err);
      return [];
    }
  };

  return {
    data,
    loading,
    error,
    updateQuestion,
    updateSummary,
    updateCode,
    getQuestionHistory,
    updateQuestionWithCode,
    saveJobContext,
    getJobContext,
    updateInterviewData,
    sendQuestionToCandidate,
    getSentQuestions,
  };
}